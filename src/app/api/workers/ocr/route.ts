// src/app/api/workers/ocr/route.ts
// Internal worker endpoint — called by QStash (prod) or direct fetch (dev)
// NEVER called directly by the client

import { NextRequest, NextResponse } from 'next/server'
import { prisma, db } from '@/lib/prisma'
import { OcrService }                from '@/lib/verification/ocr.service'
import { validateFileBuffer }        from '@/lib/verification/file-validator'
import { z }                         from 'zod'
import { createHash, createHmac, randomUUID } from 'crypto'
import { requireEnv } from '@/lib/env'
import { readBufferByKey } from '@/lib/storage/production-storage'
import {
  logVerificationPhase,
  VerificationPipelinePhase,
} from '@/lib/verification/lifecycle'

export const runtime     = 'nodejs'
export const maxDuration = 30

const JobSchema = z.object({
  jobId:      z.string().uuid(),
  documentId: z.string().uuid(),
  storageKey: z.string().min(1),
  sessionId:  z.string().uuid(),
  doctorId:   z.string().uuid(),
  doctorName: z.string().min(2),
})

export async function POST(req: NextRequest) {
  // ── Auth: only worker secret or QStash ────────────────────────────────────
  const workerSecret = req.headers.get('x-worker-secret')
  const expectedSecret = requireEnv('WORKER_SECRET')
  if (workerSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse payload ─────────────────────────────────────────────────────────
  const body   = await req.json().catch(() => null)
  const parsed = JobSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[ocr-worker] Invalid payload:', parsed.error.flatten())
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const job = parsed.data

  // ── Idempotency: skip if already completed ────────────────────────────────
  const existing = await db.jobTracking.findUnique({
    where: { id: job.jobId },
  }).catch(() => null)

  if (existing?.status === 'completed') {
    return NextResponse.json({ success: true, skipped: true })
  }

  if ((existing?.attempts ?? 0) >= (existing?.maxAttempts ?? 3)) {
    await db.jobTracking.update({
      where: { id: job.jobId },
      data:  { status: 'dead', lastError: 'Max attempts exceeded', updatedAt: new Date() },
    }).catch(() => {})
    return NextResponse.json({ error: 'Max attempts exceeded' }, { status: 422 })
  }

  // ── Mark as processing ────────────────────────────────────────────────────
  await db.jobTracking.update({
    where: { id: job.jobId },
    data:  { status: 'processing', attempts: { increment: 1 }, updatedAt: new Date() },
  }).catch(() => {})

  try {
    const docMeta = await db.verificationDocument.findUnique({
      where: { id: job.documentId },
      select: { storageBucket: true },
    }).catch(() => null)

    let buffer: Buffer | null = null
    try {
      buffer = await readBufferByKey(job.storageKey, docMeta?.storageBucket)
    } catch (fileErr) {
      console.warn(`[ocr-worker] File not found: ${job.storageKey} — advancing session anyway`, fileErr)
      // الملف غير موجود (Vercel / بيئة بلا storage) — نُحدّث الحالة ونُكمل
      await prisma.$transaction([
        prisma.verificationSession.updateMany({
          where: { id: job.sessionId, currentState: { in: ['UNVERIFIED', 'PENDING_AI'] } },
          data:  { currentState: 'LICENSE_UPLOADED' },
        }) as any,
        prisma.jobTracking.update({
          where: { id: job.jobId },
          data:  { status: 'completed', completedAt: new Date(), updatedAt: new Date(),
                   result: { note: 'OCR skipped — file not accessible' } },
        }) as any,
      ])
      return NextResponse.json({ success: true, skipped: true, reason: 'file_not_found' })
    }

    // ── Re-validate (defense in depth) ───────────────────────────────────
    const validation = validateFileBuffer(buffer)
    if (!validation.valid) throw new Error(`File validation failed: ${validation.error}`)

    // ── Google Cloud Vision OCR (مهلة 10 ثوانٍ — داخل OcrService) ───────────
    const ocrService = new OcrService()
    const ocrResult = await ocrService.processImage({
      imageBuffer: buffer,
      doctorName:  job.doctorName,
      mimeType:    validation.mimeType!,
    }).catch(async (ocrErr) => {
      console.warn(`[ocr-worker] OCR failed/timeout for ${job.jobId}:`, ocrErr instanceof Error ? ocrErr.message : ocrErr)
      await prisma.$transaction([
        prisma.verificationDocument.update({
          where: { id: job.documentId },
          data:  { isProcessed: true, flagReason: 'OCR skipped — timeout or error' },
        }) as any,
        prisma.verificationSession.updateMany({
          where: { id: job.sessionId, currentState: { in: ['UNVERIFIED', 'PENDING_AI'] } },
          data:  { currentState: 'LICENSE_UPLOADED' },
        }) as any,
        prisma.jobTracking.update({
          where: { id: job.jobId },
          data:  {
            status: 'completed', completedAt: new Date(), updatedAt: new Date(),
            result: { note: 'OCR skipped', error: String(ocrErr) },
          },
        }) as any,
      ])
      logVerificationPhase(VerificationPipelinePhase.AI_DONE, {
        sessionId: job.sessionId,
        doctorId:  job.doctorId,
        jobId:     job.jobId,
        note:      'license_ocr_skipped → LICENSE_UPLOADED',
      })
      return null
    })
    if (!ocrResult) {
      return NextResponse.json({ success: true, skipped: true, reason: 'ocr_timeout' })
    }

    console.log('[ocr-worker]', JSON.stringify({
      phase:      'ocr_completed',
      jobId:      job.jobId,
      sessionId:  job.sessionId,
      doctorId:   job.doctorId,
      confidence: ocrResult.confidenceScore,
      nameMatch:  ocrResult.nameMatchStatus,
      license:    ocrResult.extractedData.licenseNumber,
      ms:         ocrResult.processingMs,
    }))

    // ── Save to DB atomically ────────────────────────────────────────────
    await prisma.$transaction(async (tx: any) => {
      // Save OCR result
      await (tx as any).ocrResult.create({
        data: {
          documentId:      job.documentId,
          sessionId:       job.sessionId,
          extractedName:   ocrResult.extractedData.name,
          licenseNumber:   ocrResult.extractedData.licenseNumber,
          specialty:       ocrResult.extractedData.specialty,
          expiryDate:      ocrResult.extractedData.expiryDate
            ? new Date(ocrResult.extractedData.expiryDate)
            : null,
          confidenceScore: ocrResult.confidenceScore,
          nameMatchScore:  ocrResult.nameMatchScore,
          nameMatchStatus: ocrResult.nameMatchStatus,
          rawText:         ocrResult.rawText,
        },
      })

      // Mark document processed
      await (tx as any).verificationDocument.update({
        where: { id: job.documentId },
        data: {
          isProcessed: true,
          isFlagged:   ocrResult.confidenceScore < 40,
          flagReason:  ocrResult.confidenceScore < 40
            ? `OCR confidence low: ${ocrResult.confidenceScore}%`
            : null,
        },
      })

      // Advance session state (بعد نجاح OCR = ai_done في السجلات)
      await (tx as any).verificationSession.updateMany({
        where: { id: job.sessionId, currentState: { in: ['UNVERIFIED', 'PENDING_AI'] } },
        data:  {
          currentState: 'LICENSE_UPLOADED',
          ...(ocrResult.extractedData.expiryDate
            ? { licenseExpiryDate: new Date(ocrResult.extractedData.expiryDate) }
            : {}),
        },
      })

      // Mark job complete
      await (tx as any).jobTracking.update({
        where: { id: job.jobId },
        data:  {
          status:      'completed',
          completedAt: new Date(),
          updatedAt:   new Date(),
          result:      {
            confidence:   ocrResult.confidenceScore,
            nameMatch:    ocrResult.nameMatchStatus,
            licenseNumber: ocrResult.extractedData.licenseNumber,
          },
        },
      })
    })

    logVerificationPhase(VerificationPipelinePhase.AI_DONE, {
      sessionId: job.sessionId,
      doctorId:  job.doctorId,
      jobId:     job.jobId,
      confidence: ocrResult.confidenceScore,
      note:      'license_ocr_completed → LICENSE_UPLOADED',
    })

    // ── Audit log ────────────────────────────────────────────────────────
    await writeAuditLog({
      actorId:    job.doctorId,
      actorRole:  'DOCTOR',
      action:     'LICENSE_OCR_COMPLETED',
      targetType: 'verification_document',
      targetId:   job.documentId,
      payload:    {
        confidence:   ocrResult.confidenceScore,
        nameMatch:    ocrResult.nameMatchStatus,
        licenseNumber: ocrResult.extractedData.licenseNumber,
      },
    })

    return NextResponse.json({ success: true, confidence: ocrResult.confidenceScore })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[ocr-worker] Job ${job.jobId} failed:`, msg)

    await db.jobTracking.update({
      where: { id: job.jobId },
      data:  { status: 'failed', lastError: msg, lastErrorAt: new Date(), updatedAt: new Date() },
    }).catch(() => {})

    // Return 500 so QStash retries (no internal details to client)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function writeAuditLog(params: {
  actorId:    string
  actorRole:  string
  action:     string
  targetType: string
  targetId:   string
  payload:    Record<string, unknown>
}) {
  try {
    const secret    = requireEnv('AUDIT_LOG_SECRET')
    const timestamp = new Date()
    const id        = randomUUID()
    const hmacInput = [id, params.actorId, params.action, params.targetId, timestamp.toISOString()].join('|')
    const hmac      = createHmac('sha256', secret).update(hmacInput).digest('hex')

    await db.auditLog.create({
      data: {
        id,
        actorId:       params.actorId,
        actorRole:     params.actorRole,
        action:        params.action,
        targetType:    params.targetType,
        targetId:      params.targetId,
        payload:       params.payload,
        hmacSignature: hmac,
        createdAt:     timestamp,
      },
    })
  } catch (e) {
    console.error('[audit] Failed to write log:', e)
  }
}
