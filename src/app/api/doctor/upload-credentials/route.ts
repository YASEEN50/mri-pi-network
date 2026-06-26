// src/app/api/doctor/upload-credentials/route.ts
// رفع الشهادات العلمية — يقبل ملف واحد في كل طلب

import { NextRequest, NextResponse } from 'next/server'
import { rateLimitUpload } from '@/lib/rate-limit'
import { collectIntelligence }  from '@/lib/fraud-intelligence'
import { requireAuth }               from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { fromAppError, serverError } from '@/lib/api-response'
import { validateFileBuffer }        from '@/lib/verification/file-validator'
import { Role }                      from '@prisma/client'
import { randomUUID, createHash }    from 'crypto'
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
    const { userId } = auth.context

    const storageBlocked = productionStorageBlockedMessage()
    if (storageBlocked) {
      return NextResponse.json({ error: true, message: storageBlocked }, { status: 503 })
    }

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
      return NextResponse.json({ error: true, message: 'يجب رفع الملف كـ multipart' }, { status: 400 })
    }

    const file  = formData.get('file') as File | null
    const title = formData.get('title') as string | null

    if (!file)  return NextResponse.json({ error: true, message: 'لم يُرفع أي ملف' }, { status: 400 })
    if (!title) return NextResponse.json({ error: true, message: 'عنوان الشهادة مطلوب' }, { status: 400 })

    const buffer     = Buffer.from(await file.arrayBuffer())
    const validation = validateFileBuffer(buffer)
    if (!validation.valid) {
      return NextResponse.json({ error: true, message: validation.error }, { status: 400 })
    }

    // حفظ الملف
    const ext        = { 'image/jpeg': '.jpg', 'image/png': '.png', 'application/pdf': '.pdf' }[validation.mimeType!] ?? ''
    const storageKey = `credential/${randomUUID()}${ext}`
    const sha256     = createHash('sha256').update(buffer).digest('hex')
    const stored = await saveBufferByKey(
      buffer,
      storageKey,
      validation.mimeType! as AllowedMimeType,
    )

    // الحصول على الـ session النشطة
    const session = await db.verificationSession.findFirst({
      where: { doctorId: doctor.id, isActive: true },
    }).catch(() => null)

    if (!session) {
      return NextResponse.json(
        { error: true, message: 'يجب رفع رخصة المزاولة أولاً' },
        { status: 400 }
      )
    }

    // حفظ الوثيقة
    const document = await db.verificationDocument.create({
      data: {
        sessionId:     session.id,
        doctorId:      doctor.id,
        docType:       'CREDENTIAL',
        storageKey,
        storageBucket: stored.bucket,
        mimeType:      validation.mimeType!,
        fileSizeBytes: buffer.length,
        sha256Hash:    sha256,
        isProcessed:   false,
      },
    })

    // ── تحديث حالة الـ session ────────────────────────────────────────────────
    // انتقل إلى CREDENTIALS_UPLOADED فقط إذا كانت الحالة الحالية LICENSE_UPLOADED
    await db.verificationSession.updateMany({
      where: { id: session.id, currentState: 'LICENSE_UPLOADED' },
      data:  { currentState: 'CREDENTIALS_UPLOADED', updatedAt: new Date() },
    }).catch(() => {})

    // Intelligence (background)
    collectIntelligence(
      { userId, sessionId: session.id, ipAddress: ip, deviceId },
      { isDuplicateHash: false, isSimilarImage: false },
    ).catch(() => {})

    return NextResponse.json({
      success:    true,
      documentId: document.id,
      title,
      message:   'تم رفع الشهادة بنجاح',
    }, { status: 201 })

  } catch (err) {
    console.error('[upload-credentials]', err)
    return serverError()
  }
}
