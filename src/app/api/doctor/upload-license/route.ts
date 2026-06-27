// src/app/api/doctor/upload-license/route.ts
// File upload endpoint — stores file then triggers OCR job
// Client sends FILE only — extracted text is NEVER accepted

import { NextRequest, NextResponse } from 'next/server'
import { rateLimitUploadLicense, rateLimitResponse } from '@/lib/upstash-rate-limit'
import { collectIntelligence } from '@/lib/fraud-intelligence'
import { requireDoctorProfile } from '@/lib/doctor/require-doctor-profile'
import { prisma, db } from '@/lib/prisma'
import { fromAppError, serverError } from '@/lib/api-response'
import { validateFileBuffer }        from '@/lib/verification/file-validator'
import { randomUUID, createHash }    from 'crypto'
import {
  productionStorageBlockedMessage,
  saveBufferByKey,
} from '@/lib/storage/production-storage'
import type { AllowedMimeType } from '@/core/interfaces/services/file-storage.interface'
import {
  logVerificationPhase,
  VerificationPipelinePhase,
} from '@/lib/verification/lifecycle'

export const runtime     = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ───────────────────────────────────────────────────────────
    const auth = await requireDoctorProfile()
    if (!auth.success) return fromAppError(auth.error)
    const { userId, doctorId, firstName, lastName } = auth

    const storageBlocked = productionStorageBlockedMessage()
    if (storageBlocked) {
      return NextResponse.json({ error: true, message: storageBlocked }, { status: 503 })
    }

    // Rate limiting — 5 رفوعات/دقيقة لكل طبيب (Upstash)
    const rl = await rateLimitUploadLicense(userId)
    if (!rl.success) {
      return NextResponse.json(rateLimitResponse(rl), {
        status: 429,
        headers: { 'Retry-After': String(rl.resetIn) },
      })
    }

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'

    // ── 2. Idempotency check ──────────────────────────────────────────────
    const idempotencyKey = req.headers.get('x-idempotency-key') ?? randomUUID()

    const existing = await db.idempotencyKey.findFirst({
      where: { doctorUserId: userId, step: 'LICENSE_UPLOAD' },
    }).catch(() => null)

    if (existing) {
      return NextResponse.json(existing.responseSnapshot, { status: 200 })
    }

    // ── 3. Get doctor profile ─────────────────────────────────────────────
    const doctor = { id: doctorId, firstName, lastName }
    // ── 4. Parse multipart ────────────────────────────────────────────────
    const formData = await req.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json(
        { error: true, message: 'يجب رفع الملف كـ multipart/form-data' },
        { status: 400 }
      )
    }

    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json(
        { error: true, message: 'لم يُرفع أي ملف. اسم الحقل يجب أن يكون "file"' },
        { status: 400 }
      )
    }

    // ── 5. Convert to Buffer ──────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer())

    // ── 6. Validate magic bytes ───────────────────────────────────────────
    const validation = validateFileBuffer(buffer)
    if (!validation.valid) {
      return NextResponse.json(
        { error: true, message: validation.error },
        { status: 400 }
      )
    }

    // ── 7. Store file ─────────────────────────────────────────────────────
    const ext        = { 'image/jpeg': '.jpg', 'image/png': '.png', 'application/pdf': '.pdf' }[validation.mimeType!] ?? ''
    const storageKey = `license/${randomUUID()}${ext}`
    const sha256     = createHash('sha256').update(buffer).digest('hex')
    const stored = await saveBufferByKey(
      buffer,
      storageKey,
      validation.mimeType! as AllowedMimeType,
    )

    // ── 8. Get or create verification session ─────────────────────────────
    let session = await db.verificationSession.findFirst({
      where: { doctorId: doctor.id, isActive: true },
      include: { documents: { where: { docType: 'CREDENTIAL' }, take: 1 } },
    }).catch(() => null)

    if (!session?.documents?.length) {
      return NextResponse.json(
        { error: true, message: 'ارفع الشهادة الجامعية أولاً' },
        { status: 400 },
      )
    }

    if (session.currentState === 'PENDING_AI') {
      await db.verificationSession.update({
        where: { id: session.id },
        data:  { currentState: 'UNVERIFIED', updatedAt: new Date() },
      })
      session = { ...session, currentState: 'UNVERIFIED' }
      logVerificationPhase(VerificationPipelinePhase.PENDING_AI, {
        doctorId: doctor.id,
        note:     'license_upload_started → UNVERIFIED',
      })
    }

    // ── 9. Create document record ─────────────────────────────────────────
    const document = await db.verificationDocument.create({
      data: {
        sessionId:     session.id,
        doctorId:      doctor.id,
        docType:       'LICENSE',
        storageKey,
        storageBucket: stored.bucket,
        mimeType:      validation.mimeType!,
        fileSizeBytes: buffer.length,
        sha256Hash:    sha256,
        isProcessed:   false,
      },
    })

    await prisma.doctorProfile.update({
      where: { id: doctor.id },
      data:  { licenseImageUrl: stored.url },
    })

    // ── 10. Enqueue OCR job ───────────────────────────────────────────────
    const jobId      = randomUUID()
    const doctorName = `${doctor.firstName} ${doctor.lastName}`.trim()

    await db.jobTracking.create({
      data: {
        id:             jobId,
        sessionId:      session.id,
        doctorId:       doctor.id,
        jobType:        'ocr-processing',
        status:         'pending',
        idempotencyKey: idempotencyKey,
        attempts:       0,
        maxAttempts:    3,
      },
    })

    // ── Intelligence Collection (background) ────────────────────────────────
    const deviceId = req.headers.get('x-device-id') ?? 'unknown'
    const userAgent = req.headers.get('user-agent') ?? undefined

    collectIntelligence(
      { userId, sessionId: session.id, ipAddress: ip, deviceId, userAgent },
      { isDuplicateHash: false, isSimilarImage: false },
    ).catch(err => console.error('[upload-license] intelligence error:', err))

    // Fire-and-forget OCR worker (يتطلب WORKER_SECRET مطابقاً لعامل /api/workers/ocr)
    const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const workerSecret = process.env.WORKER_SECRET
    if (!workerSecret) {
      // لا نرمي استثناء — الرفع ينجح لكن OCR يُتخطى
      console.error('[upload-license] WORKER_SECRET missing, OCR will be skipped')
    } else {
      fetch(`${appUrl}/api/workers/ocr`, {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-worker-secret': workerSecret,
        },
        body: JSON.stringify({
          jobId,
          documentId: document.id,
          storageKey,
          sessionId:  session.id,
          doctorId:   doctor.id,
          doctorName,
        }),
      }).catch(err => console.error('[upload-license] OCR trigger failed:', err))
    }

    // ── 11. Cache idempotency response ────────────────────────────────────
    const response = {
      success:    true,
      message:    'تم رفع الرخصة. جاري معالجة البيانات...',
      documentId: document.id,
      jobId,
      status:     'processing',
    }

    await db.idempotencyKey.create({
      data: {
        doctorUserId:     userId,
        step:             'LICENSE_UPLOAD',
        idempotencyKey,
        responseStatus:   202,
        responseSnapshot: response,
        expiresAt:        new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    }).catch(() => {})

    // ── 12. Return 202 immediately ────────────────────────────────────────
    return NextResponse.json(response, { status: 202 })

  } catch (err) {
    console.error('[upload-license] Error:', err)
    return serverError()
  }
}
