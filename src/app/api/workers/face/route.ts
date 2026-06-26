// src/app/api/workers/face/route.ts
// Worker: يقارن الوجهين server-side ويحفظ النتيجة

import { NextRequest, NextResponse } from 'next/server'
import { prisma, db } from '@/lib/prisma'
import { getFaceService }            from '@/lib/verification/face.service'
import { z }                         from 'zod'
import { createHmac, randomUUID }    from 'crypto'
import { requireEnv }                from '@/lib/env'
import { readBufferByKey }           from '@/lib/storage/production-storage'
import {
  ensureLegacyHumanQueue,
  logVerificationPhase,
  VerificationPipelinePhase,
} from '@/lib/verification/lifecycle'

export const runtime     = 'nodejs'
export const maxDuration = 60

const JobSchema = z.object({
  jobId:       z.string().uuid(),
  sessionId:   z.string().uuid(),
  doctorId:    z.string().uuid(),
  selfieDocId: z.string().uuid(),
  idDocId:     z.string().uuid(),
  selfieKey:   z.string().min(1),
  idKey:       z.string().min(1),
})

export async function POST(req: NextRequest) {
  // Auth
  const secret = req.headers.get('x-worker-secret')
  if (secret !== requireEnv('WORKER_SECRET')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body   = await req.json().catch(() => null)
  const parsed = JobSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  const job = parsed.data

  // Idempotency
  const existing = await db.jobTracking.findUnique({
    where: { id: job.jobId },
  }).catch(() => null)

  if (existing?.status === 'completed') {
    return NextResponse.json({ success: true, skipped: true })
  }

  // Mark processing
  await db.jobTracking.update({
    where: { id: job.jobId },
    data:  { status: 'processing', attempts: { increment: 1 }, updatedAt: new Date() },
  }).catch(() => {})

  try {
    // Read images from storage
    let selfieBuffer: Buffer
    let idBuffer: Buffer

    const selfieDoc = await db.verificationDocument.findUnique({
      where: { id: job.selfieDocId },
      select: { storageBucket: true },
    }).catch(() => null)

    try {
      ;[selfieBuffer, idBuffer] = await Promise.all([
        readBufferByKey(job.selfieKey, selfieDoc?.storageBucket),
        readBufferByKey(job.idKey, selfieDoc?.storageBucket),
      ])
    } catch (fileErr) {
      console.warn('[face-worker] Files not found — advancing to PENDING_HUMAN without face comparison')
      // الملفات غير موجودة — نُقدّم الـ session مباشرة للأدمن
      await prisma.$transaction([
        prisma.verificationSession.updateMany({
          where: { id: job.sessionId, currentState: { in: ['FACE_SUBMITTED', 'CREDENTIALS_UPLOADED', 'LICENSE_UPLOADED'] } },
          data:  { currentState: 'PENDING_HUMAN' },
        }) as any,
        prisma.jobTracking.update({
          where: { id: job.jobId },
          data:  { status: 'completed', completedAt: new Date(), updatedAt: new Date(),
                   result: { note: 'Face comparison skipped — files not accessible' } },
        }) as any,
      ])
      await ensureLegacyHumanQueue(job.doctorId, { notify: true })
      logVerificationPhase(VerificationPipelinePhase.PENDING_HUMAN, {
        doctorId:  job.doctorId,
        sessionId: job.sessionId,
        source:    'face-worker',
        note:      'skipped_files → legacy_queue',
      })
      return NextResponse.json({ success: true, skipped: true, reason: 'files_not_found' })
    }

    // Compare faces — strategy pattern
    const faceService = getFaceService()
    const result      = await faceService.compare(selfieBuffer, idBuffer)

    console.log(`[face-worker] Job ${job.jobId}:`, {
      score:       result.score,
      confidence:  result.confidence,
      service:     result.serviceUsed,
    })

    // حفظ النتيجة وتقدم الـ session
    await prisma.$transaction(async (tx: any) => {
      // حفظ face verification result
      await (tx as any).faceVerification.create({
        data: {
          sessionId:     job.sessionId,
          doctorId:      job.doctorId,
          selfieDocId:   job.selfieDocId,
          idDocId:       job.idDocId,
          matchScore:    result.score,
          confidence:    result.confidence,
          facesDetected: result.facesDetected,
          serviceUsed:   result.serviceUsed,
          rawResponse:   result.details ?? {},
        },
      })

      // تقدم session → PENDING_HUMAN (مراجعة بشرية)
      await (tx as any).verificationSession.updateMany({
        where: {
          id: job.sessionId,
          currentState: { in: ['FACE_SUBMITTED', 'SCORING', 'FRAUD_CHECK'] },
        },
        data: { currentState: 'PENDING_HUMAN' },
      })

      // Mark job complete
      await (tx as any).jobTracking.update({
        where: { id: job.jobId },
        data: {
          status:      'completed',
          completedAt: new Date(),
          updatedAt:   new Date(),
          result:      { score: result.score, confidence: result.confidence },
        },
      })
    })

    await ensureLegacyHumanQueue(job.doctorId, { notify: true })
    logVerificationPhase(VerificationPipelinePhase.PENDING_HUMAN, {
      doctorId:  job.doctorId,
      sessionId: job.sessionId,
      source:    'face-worker',
      note:      'face_complete → legacy_queue',
    })

    // Trigger fraud + score worker after face completion
    const appUrl2 = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const fraudJobId = randomUUID()
    await db.jobTracking.create({
      data: {
        id:             fraudJobId,
        sessionId:      job.sessionId,
        doctorId:       job.doctorId,
        jobType:        'fraud-check',
        status:         'pending',
        idempotencyKey: `fraud-${job.sessionId}`,
        attempts:       0,
        maxAttempts:    3,
      },
    }).catch(() => {})

    fetch(`${appUrl2}/api/workers/fraud`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-worker-secret': requireEnv('WORKER_SECRET') },
      body:    JSON.stringify({ jobId: fraudJobId, sessionId: job.sessionId, doctorId: job.doctorId }),
    }).catch((e: any) => console.error('[face-worker] Fraud trigger failed:', e))

    // Audit log
    await writeAuditLog({
      actorId:    job.doctorId,
      actorRole:  'DOCTOR',
      action:     'FACE_VERIFICATION_COMPLETED',
      targetType: 'verification_session',
      targetId:   job.sessionId,
      payload:    { score: result.score, confidence: result.confidence, service: result.serviceUsed },
    })

    return NextResponse.json({ success: true, score: result.score })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown'
    console.error(`[face-worker] Job ${job.jobId} failed:`, msg)

    await db.jobTracking.update({
      where: { id: job.jobId },
      data:  { status: 'failed', lastError: msg, lastErrorAt: new Date(), updatedAt: new Date() },
    }).catch(() => {})

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function writeAuditLog(params: {
  actorId: string; actorRole: string; action: string
  targetType: string; targetId: string; payload: Record<string, unknown>
}) {
  try {
    const secret    = requireEnv('AUDIT_LOG_SECRET')
    const timestamp = new Date()
    const id        = randomUUID()
    const hmac      = createHmac('sha256', secret)
      .update([id, params.actorId, params.action, params.targetId, timestamp.toISOString()].join('|'))
      .digest('hex')

    await db.auditLog.create({
      data: { id, ...params, hmacSignature: hmac, createdAt: timestamp },
    })
  } catch {}
}
