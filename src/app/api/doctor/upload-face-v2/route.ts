// src/app/api/doctor/upload-face-v2/route.ts
// رفع صور الهوية + trigger face comparison worker

import { NextRequest, NextResponse } from 'next/server'
import { rateLimitUpload }       from '@/lib/rate-limit'
import { collectIntelligence }  from '@/lib/fraud-intelligence'
import { requireAuth }               from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { fromAppError, serverError } from '@/lib/api-response'
import { validateFileBuffer }        from '@/lib/verification/file-validator'
import { Role }                      from '@prisma/client'
import { randomUUID, createHash }    from 'crypto'
import { requireEnv }                from '@/lib/env'
import {
  productionStorageBlockedMessage,
  saveBufferByKey,
} from '@/lib/storage/production-storage'
import type { AllowedMimeType } from '@/core/interfaces/services/file-storage.interface'

export const runtime     = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const storageBlocked = productionStorageBlockedMessage()
    if (storageBlocked) {
      return NextResponse.json({ error: true, message: storageBlocked }, { status: 503 })
    }

    const { userId } = auth.context
    const ip       = req.headers.get('x-forwarded-for') ?? 'unknown'
    const deviceId = req.headers.get('x-device-id') ?? 'unknown'

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId }, select: { id: true },
    })
    if (!doctor) {
      return NextResponse.json({ error: true, message: 'ملف الطبيب غير موجود' }, { status: 404 })
    }

    const formData = await req.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json({ error: true, message: 'يجب رفع الملفات كـ multipart' }, { status: 400 })
    }

    const selfieFile = formData.get('selfie')     as File | null
    const idFile     = formData.get('idDocument') as File | null

    if (!selfieFile) return NextResponse.json({ error: true, message: 'الصورة الشخصية مطلوبة' }, { status: 400 })
    if (!idFile)     return NextResponse.json({ error: true, message: 'صورة الوثيقة مطلوبة' },   { status: 400 })

    // Validate both files
    const selfieBuffer     = Buffer.from(await selfieFile.arrayBuffer())
    const idBuffer         = Buffer.from(await idFile.arrayBuffer())
    const selfieValidation = validateFileBuffer(selfieBuffer)
    const idValidation     = validateFileBuffer(idBuffer)

    if (!selfieValidation.valid) {
      return NextResponse.json({ error: true, message: `الصورة الشخصية: ${selfieValidation.error}` }, { status: 400 })
    }
    if (!idValidation.valid) {
      return NextResponse.json({ error: true, message: `صورة الوثيقة: ${idValidation.error}` }, { status: 400 })
    }

    // Get active session
    const session = await db.verificationSession.findFirst({
      where: { doctorId: doctor.id, isActive: true },
    }).catch(() => null)

    if (!session) {
      return NextResponse.json(
        { error: true, message: 'أكمل رفع الرخصة والشهادات أولاً' },
        { status: 400 }
      )
    }

    // Store files
    async function storeFile(buffer: Buffer, folder: string, mimeType: string) {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png' }[mimeType] ?? '.jpg'
      const key = `${folder}/${randomUUID()}${ext}`
      const stored = await saveBufferByKey(buffer, key, mimeType as AllowedMimeType)
      return { key: stored.key, sha256: createHash('sha256').update(buffer).digest('hex'), bucket: stored.bucket }
    }

    const { key: selfieKey, sha256: selfieSha, bucket } = await storeFile(selfieBuffer, 'selfie', selfieValidation.mimeType!)
    const { key: idKey,     sha256: idSha }     = await storeFile(idBuffer,     'id-doc', idValidation.mimeType!)

    // Save documents in DB
    const selfieDoc = await db.verificationDocument.create({
      data: {
        sessionId: session.id, doctorId: doctor.id, docType: 'SELFIE',
        storageKey: selfieKey, storageBucket: bucket,
        mimeType: selfieValidation.mimeType!, fileSizeBytes: selfieBuffer.length,
        sha256Hash: selfieSha, isProcessed: false,
      },
    })

    const idDoc = await db.verificationDocument.create({
      data: {
        sessionId: session.id, doctorId: doctor.id, docType: 'ID_DOCUMENT',
        storageKey: idKey, storageBucket: bucket,
        mimeType: idValidation.mimeType!, fileSizeBytes: idBuffer.length,
        sha256Hash: idSha, isProcessed: false,
      },
    })

    // Advance state → FACE_SUBMITTED
    await db.verificationSession.update({
      where: { id: session.id },
      data:  { currentState: 'FACE_SUBMITTED' },
    })

    // Create face comparison job
    const jobId = randomUUID()
    await db.jobTracking.create({
      data: {
        id:             jobId,
        sessionId:      session.id,
        doctorId:       doctor.id,
        jobType:        'face-comparison',
        status:         'pending',
        idempotencyKey: `face-${session.id}`,
        attempts:       0,
        maxAttempts:    3,
      },
    })

    // Trigger face worker (fire and forget)
    const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    fetch(`${appUrl}/api/workers/face`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-worker-secret': requireEnv('WORKER_SECRET'),
      },
      body: JSON.stringify({
        jobId,
        sessionId:   session.id,
        doctorId:    doctor.id,
        selfieDocId: selfieDoc.id,
        idDocId:     idDoc.id,
        selfieKey,
        idKey,
      }),
    }).catch(err => console.error('[upload-face-v2] Worker trigger failed:', err))

    // Intelligence (background)
    collectIntelligence(
      { userId, sessionId: session.id, ipAddress: ip, deviceId },
      { isDuplicateHash: false, isSimilarImage: false },
    ).catch(() => {})

    return NextResponse.json({
      success:   true,
      jobId,
      message:   'تم رفع الصور. جاري مقارنة الوجه على السيرفر...',
      newState:  'FACE_SUBMITTED',
    }, { status: 202 })

  } catch (err) {
    console.error('[upload-face-v2]', err)
    return serverError()
  }
}
