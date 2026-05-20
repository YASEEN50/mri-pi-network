// src/lib/verification/decision.service.ts
// منطق القرارات الآلية للتحقق

import { prisma, db } from '@/lib/prisma'
import { getVerificationConfig } from './config.service'
// calculateOverallConfidence moved to ocr.service v2
const calculateOverallConfidence = (face: number, ocr: number) => Math.round((face * 0.6) + (ocr * 0.4))
import { ActivityType } from '@prisma/client'

// استخدام string literals للأنواع الجديدة حتى يُشغَّل prisma generate
const VerificationStatus = {
  PENDING:     'PENDING',
  AI_APPROVED: 'AI_APPROVED',
  AI_REJECTED: 'AI_REJECTED',
  VERIFIED:    'VERIFIED',
  REJECTED:    'REJECTED',
} as const

const VerificationStage = {
  UPLOAD_CERTIFICATE: 'UPLOAD_CERTIFICATE',
  FACE_COMPARE:       'FACE_COMPARE',
  AI_DECISION:        'AI_DECISION',
  ADMIN_REVIEW:       'ADMIN_REVIEW',
  FINAL_DECISION:     'FINAL_DECISION',
} as const

const QueueStatus = {
  WAITING:    'WAITING',
  IN_REVIEW:  'IN_REVIEW',
  COMPLETED:  'COMPLETED',
} as const

export async function makeAIDecision(verificationId: string): Promise<{
  decision: 'APPROVED' | 'REJECTED'
  confidence: number
  reason: string
}> {
  const config = await getVerificationConfig()

  const verification = await db.doctorVerification.findUnique({
    where: { id: verificationId },
    include: { certificates: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  if (!verification) throw new Error('Verification not found')

  const cert = verification.certificates[0]

  const confidence = calculateOverallConfidence(
    Math.round(verification.faceMatchConfidence ?? 0),
    Math.round(cert?.aiConfidence ?? 0)
  )

  // تحديث الدرجة الكلية
  await db.doctorVerification.update({
    where: { id: verificationId },
    data:  { overallConfidence: confidence },
  })

  const threshold = config.ai_confidence_threshold
  if (confidence >= threshold) {
    return {
      decision:   'APPROVED',
      confidence,
      reason:     `درجة الثقة ${confidence}% تتجاوز الحد المطلوب ${threshold}%`,
    }
  } else {
    return {
      decision:   'REJECTED',
      confidence,
      reason:     `درجة الثقة ${confidence}% أقل من الحد المطلوب ${threshold}%`,
    }
  }
}

export async function processAIDecision(
  verificationId: string,
  actorId: string,
  ipAddress?: string
) {
  const config   = await getVerificationConfig()
  const { decision, confidence, reason } = await makeAIDecision(verificationId)

  const verification = await db.doctorVerification.findUnique({
    where: { id: verificationId },
    include: { doctor: { include: { user: true } } },
  })
  if (!verification) return

  if (decision === 'APPROVED') {
    // إضافة لقائمة الانتظار للمراجعة البشرية
    await prisma.$transaction([
      db.doctorVerification.update({
        where: { id: verificationId },
        data: {
          verificationStatus: VerificationStatus.AI_APPROVED,
          currentStage: VerificationStage.ADMIN_REVIEW,
          overallConfidence: confidence,
        },
      }),
      db.verificationQueue.upsert({
        where:  { verificationId },
        update: { status: QueueStatus.WAITING },
        create: {
          verificationId,
          priority: confidence >= 90 ? 3 : confidence >= 80 ? 5 : 7,
          status:   QueueStatus.WAITING,
        },
      }),
    ])

    // إشعار للطبيب
    await sendVerificationNotification({
      userId:  verification.doctor.userId,
      type:    'AI_APPROVED',
      title:   'طلبك قيد المراجعة البشرية ✅',
      message: `تم تحليل مستنداتك بنجاح (درجة الثقة: ${confidence}%). سيتم مراجعتها من قبل فريقنا قريباً.`,
    })
  } else {
    await db.doctorVerification.update({
      where: { id: verificationId },
      data: {
        verificationStatus: VerificationStatus.AI_REJECTED,
        currentStage:       VerificationStage.AI_DECISION,
        overallConfidence:  confidence,
        rejectionReason:    reason,
      },
    })

    // إشعار للطبيب بالرفض
    await sendVerificationNotification({
      userId:  verification.doctor.userId,
      type:    'AI_REJECTED',
      title:   'يرجى مراجعة مستنداتك ❌',
      message: `لم تكتمل عملية التحقق التلقائي. ${reason}. يرجى إعادة رفع المستندات.`,
    })
  }

  // تسجيل في AuditLog
  await prisma.activityLog.create({
    data: {
      actorId:    actorId,
      action:     ActivityType.AI_DECISION,
      targetType: 'VERIFICATION',
      targetId:   verificationId,
      details:    { decision, confidence, reason },
      ipAddress,
    },
  })
}

export async function sendVerificationNotification(params: {
  userId:  string
  type:    string
  title:   string
  message: string
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      title:  params.title,
      body:   params.message,
      type:   params.type,
    },
  })
}
