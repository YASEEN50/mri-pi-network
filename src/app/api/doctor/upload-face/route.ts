// src/app/api/doctor/upload-face/route.ts
// مقارنة الوجهين تتم في المتصفح باستخدام face-api.js
// هنا نحفظ النتيجة فقط

import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role, ActivityType } from '@prisma/client'
import { getVerificationConfig } from '@/lib/verification/config.service'
import { getFileStorage } from '@/infrastructure/storage/storage.factory'
import { z } from 'zod'

const Schema = z.object({
  faceMatchScore:  z.number().min(0).max(100),
  selfieBase64:    z.string().optional(),
  idImageBase64:   z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const config = await getVerificationConfig()
    const body   = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { faceMatchScore, selfieBase64, idImageBase64 } = parsed.data
    const userId = auth.context.userId

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId } })
    if (!doctor) return ok({ error: true, message: 'ملف الطبيب غير موجود' })

    // حفظ الصور
    const storage = getFileStorage()
    let selfieUrl = '', idImageUrl = ''
    try {
      if (selfieBase64) {
        const buf = Buffer.from(selfieBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
        const selfieUploaded = await storage.upload(buf, { folder: 'avatars', mimeType: 'image/jpeg' })
          selfieUrl = selfieUploaded.url
      }
      if (idImageBase64) {
        const buf = Buffer.from(idImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
        const idUploaded = await storage.upload(buf, { folder: 'avatars', mimeType: 'image/jpeg' })
          idImageUrl = idUploaded.url
      }
    } catch { /* تجاهل أخطاء الحفظ */ }

    const matched = faceMatchScore >= config.face_match_threshold
    const faceStatus = matched ? 'MATCHED' : 'NOT_MATCHED'

    // تحديث أو إنشاء verification
    const verification = await db.doctorVerification.upsert({
      where:  { doctorId: doctor.id },
      update: {
        faceVerificationStatus: faceStatus,
        faceMatchConfidence:    faceMatchScore,
        selfieImageUrl:         selfieUrl || undefined,
        idImageUrl:             idImageUrl || undefined,
        currentStage:           'FACE_COMPARE',
      },
      create: {
        doctorId:               doctor.id,
        faceVerificationStatus: faceStatus,
        faceMatchConfidence:    faceMatchScore,
        selfieImageUrl:         selfieUrl,
        idImageUrl,
        currentStage:           'FACE_COMPARE',
      },
    })

    // سجل النشاط
    await prisma.activityLog.create({
      data: {
        actorId:    userId,
        action:     ActivityType.FACE_COMPARE,
        targetType: 'VERIFICATION',
        targetId:   verification.id,
        details:    { faceMatchScore, matched, threshold: config.face_match_threshold },
        ipAddress:  req.headers.get('x-forwarded-for') ?? undefined,
      },
    })

    return ok({
      verificationId:         verification.id,
      faceMatchScore,
      faceMatchStatus:        faceStatus,
      passed:                 matched,
      message:                matched
        ? `تم التحقق من الوجه بنجاح (${faceMatchScore}%)`
        : `نسبة التطابق منخفضة (${faceMatchScore}%) — الحد الأدنى ${config.face_match_threshold}%`,
    })
  } catch (err) {
    console.error('[POST /api/doctor/upload-face]', err)
    return serverError()
  }
}
