// src/app/api/admin/review/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role, ActivityType, ApprovalStatus } from '@prisma/client'
import { sendVerificationNotification } from '@/lib/verification/decision.service'
import { z } from 'zod'

const Schema = z.object({
  verificationId: z.string().uuid(),
  decision:       z.enum(['APPROVE', 'REJECT']),
  notes:          z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const body   = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { verificationId, decision, notes } = parsed.data
    const reviewerId = auth.context.userId
    const ip         = req.headers.get('x-forwarded-for') ?? undefined

    const verification = await db.doctorVerification.findUnique({
      where:   { id: verificationId },
      include: { doctor: { include: { user: true } }, certificates: { take: 1 } },
    })
    if (!verification) return ok({ error: true, message: 'الطلب غير موجود' })

    const isApprove = decision === 'APPROVE'

    await prisma.$transaction([
      // تحديث حالة التحقق
      db.doctorVerification.update({
        where: { id: verificationId },
        data: {
          verificationStatus: isApprove ? 'VERIFIED' : 'REJECTED',
          currentStage:       'FINAL_DECISION',
          rejectionReason:    isApprove ? null : (notes ?? 'رفض من المشرف'),
        },
      }),
      // تحديث حالة ملف الطبيب الرسمية
      prisma.doctorProfile.update({
        where: { id: verification.doctorId },
        data: {
          approvalStatus: isApprove ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
          approvalNotes:  notes,
          approvedBy:     isApprove ? reviewerId : undefined,
          approvedAt:     isApprove ? new Date() : undefined,
        },
      }),
      // تحديث قائمة الانتظار
      db.verificationQueue.updateMany({
        where: { verificationId },
        data:  { status: 'COMPLETED', assignedTo: reviewerId },
      }),
      // تحديث الشهادة
      ...(verification.certificates[0] ? [
        db.doctorCertificate.update({
          where: { id: verification.certificates[0].id },
          data: {
            humanStatus:  isApprove ? 'MATCHED' : 'NOT_MATCHED',
            humanNotes:   notes,
            reviewedBy:   reviewerId,
            reviewedAt:   new Date(),
            status:       isApprove ? 'HUMAN_APPROVED' : 'HUMAN_REJECTED',
          },
        }),
      ] : []),
    ])

    // سجل النشاط
    await prisma.activityLog.create({
      data: {
        actorId:    reviewerId,
        action:     isApprove ? ActivityType.ADMIN_REVIEW_APPROVE : ActivityType.ADMIN_REVIEW_REJECT,
        targetType: 'VERIFICATION',
        targetId:   verificationId,
        details:    { decision, notes },
        ipAddress:  ip,
      },
    })

    // إشعار للطبيب
    await sendVerificationNotification({
      userId:  verification.doctor.userId,
      type:    isApprove ? 'VERIFIED' : 'REJECTED',
      title:   isApprove ? '🎉 تم التحقق من حسابك' : '❌ تم رفض طلب التحقق',
      message: isApprove
        ? 'تهانينا! تم التحقق من هويتك ومؤهلاتك. يمكنك الآن استقبال المرضى.'
        : `تم رفض طلب التحقق. السبب: ${notes ?? 'لم يُذكر سبب'}. يمكنك إعادة التقديم.`,
    })

    return ok({
      message: isApprove ? 'تم قبول الطبيب بنجاح' : 'تم رفض الطلب',
      decision,
    })
  } catch (err) {
    console.error('[POST /api/admin/review]', err)
    return serverError()
  }
}
