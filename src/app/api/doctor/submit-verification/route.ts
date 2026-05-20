// src/app/api/doctor/submit-verification/route.ts
// يُرسل طلب التحقق للمراجعة البشرية — نظام v2 (VerificationSession)

import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import {
  ensureLegacyHumanQueue,
  logVerificationPhase,
  VerificationPipelinePhase,
  isHumanReviewSessionState,
} from '@/lib/verification/lifecycle'
import { Role, ActivityType } from '@prisma/client'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const { userId } = auth.context
    const ip = req.headers.get('x-forwarded-for') ?? undefined

    const doctor = await prisma.doctorProfile.findUnique({
      where:  { userId },
      select: { id: true },
    })
    if (!doctor) return ok({ error: true, message: 'ملف الطبيب غير موجود' })

    // جلب الـ session النشطة (v2)
    const session = await db.verificationSession.findFirst({
      where:   { doctorId: doctor.id, isActive: true },
      include: {
        documents: { select: { id: true, docType: true, isProcessed: true } },
      },
    }).catch(() => null)

    if (!session) {
      return ok({ error: true, message: 'لم تبدأ عملية التحقق بعد. يجب رفع رخصة المزاولة أولاً' })
    }

    // التحقق من اكتمال الخطوات الأساسية
    const hasLicense = session.documents.some((d: any) => d.docType === 'LICENSE'     && d.isProcessed)
    const hasSelfie  = session.documents.some((d: any) => d.docType === 'SELFIE'      && d.isProcessed)
    const hasIdDoc   = session.documents.some((d: any) => d.docType === 'ID_DOCUMENT' && d.isProcessed)

    if (!hasLicense) {
      return ok({ error: true, message: 'يجب رفع رخصة المزاولة وانتظار معالجتها أولاً' })
    }
    if (!hasSelfie || !hasIdDoc) {
      return ok({ error: true, message: 'يجب إتمام خطوة التحقق من الوجه أولاً' })
    }

    // منع الإرسال المكرر
    if (isHumanReviewSessionState(session.currentState)) {
      return ok({ error: true, message: 'طلبك قيد المراجعة بالفعل' })
    }
    if (session.currentState === 'APPROVED') {
      return ok({ error: true, message: 'تم قبول طلبك مسبقاً' })
    }
    if (session.currentState === 'REJECTED') {
      return ok({ error: true, message: 'تم رفض طلبك. يرجى التواصل مع الدعم' })
    }

    // تقدم الـ session → pending_human (PENDING_HUMAN)
    await db.verificationSession.update({
      where: { id: session.id },
      data:  { currentState: 'PENDING_HUMAN', updatedAt: new Date() },
    })

    await ensureLegacyHumanQueue(doctor.id, { notify: true })
    logVerificationPhase(VerificationPipelinePhase.PENDING_HUMAN, {
      sessionId: session.id,
      doctorId:  doctor.id,
      source:    'submit-verification',
    })

    // سجل النشاط
    await prisma.activityLog.create({
      data: {
        actorId:    userId,
        action:     ActivityType.SUBMIT_VERIFICATION,
        targetType: 'VERIFICATION_SESSION',
        targetId:   session.id,
        ipAddress:  ip,
      },
    })

    // إشعار للطبيب
    await prisma.notification.create({
      data: {
        userId,
        title: '📋 تم إرسال طلبك للمراجعة',
        body:  'تم استلام طلب التحقق وسيتم مراجعته من فريقنا قريباً.',
        type:  'VERIFICATION_SUBMITTED',
        data:  { sessionId: session.id },
      },
    })

    return ok({
      sessionId: session.id,
      message:   'تم إرسال طلبك للمراجعة، سيتم إعلامك بالنتيجة قريباً',
    })

  } catch (err) {
    console.error('[POST /api/doctor/submit-verification]', err)
    return serverError()
  }
}
