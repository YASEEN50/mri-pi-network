// src/lib/notifications/service.ts
// إشعارات داخل التطبيق + تفعيل البريد عند الحاجة

import { prisma } from '@/lib/prisma'
import { Role, Prisma } from '@prisma/client'
import {
  sendDoctorAiVerificationCompleteEmail,
  sendDoctorApprovedEmail,
  sendFacilityDoctorApprovedEmail,
} from '@/lib/email'

async function createInApp(
  userId: string,
  title: string,
  body: string,
  type: string,
  data?: Prisma.InputJsonValue,
) {
  await prisma.notification.create({
    data: {
      userId,
      title,
      body,
      type,
      data: data ?? {},
    },
  })
}

/** اكتمال التحقق الآلي → بريد + إشعار للطبيب */
export async function notifyDoctorAutomatedVerificationComplete(doctorId: string) {
  const doctor = await prisma.doctorProfile.findUnique({
    where:  { id: doctorId },
    select: {
      id: true, firstName: true, lastName: true,
      user: { select: { id: true, email: true } },
    },
  })
  if (!doctor?.user) return

  const name = `${doctor.firstName} ${doctor.lastName}`.trim()
  await createInApp(
    doctor.user.id,
    'اكتمل التحقق الآلي',
    'تمت معالجة رخصتك وبياناتك آلياً. طلبك الآن في قائمة المراجعة البشرية.',
    'AI_VERIFICATION_COMPLETE',
    { doctorId },
  )

  if (doctor.user.email) {
    sendDoctorAiVerificationCompleteEmail(doctor.user.email, name).catch(err =>
      console.error('[notifications] AI complete email failed:', err),
    )
  }
}

/** طبيب جديد بانتظار المراجعة → إشعار واجهة لجميع الأدمن */
export async function notifyAdminsNewDoctorForReview(
  doctorId: string,
  sessionId?: string,
) {
  const doctor = await prisma.doctorProfile.findUnique({
    where:  { id: doctorId },
    select: { firstName: true, lastName: true },
  })
  if (!doctor) return

  const name = `${doctor.firstName} ${doctor.lastName}`.trim()
  const admins = await prisma.user.findMany({
    where: {
      role:      { in: [Role.ADMIN, Role.OWNER] },
      isActive:  true,
      deletedAt: null,
    },
    select: { id: true },
  })

  if (admins.length === 0) return

  await prisma.notification.createMany({
    data: admins.map(a => ({
      userId: a.id,
      title:  'طبيب جديد بانتظار المراجعة',
      body:   `الدكتور ${name} أكمل التحقق الآلي ويحتاج موافقة الأدمن.`,
      type:   'DOCTOR_PENDING_REVIEW',
      data:   { doctorId, sessionId: sessionId ?? null },
    })),
  })
}

/** موافقة الأدمن → الطبيب + المنشآت المرتبطة */
export async function notifyDoctorAndFacilitiesApproved(doctorId: string) {
  const doctor = await prisma.doctorProfile.findUnique({
    where:  { id: doctorId },
    select: {
      id: true, firstName: true, lastName: true,
      user: { select: { id: true, email: true } },
      facilities: {
        where:  { isActive: true },
        select: {
          facility: {
            select: {
              id: true, name: true,
              user: { select: { id: true, email: true } },
            },
          },
        },
      },
    },
  })
  if (!doctor?.user) return

  const name = `${doctor.firstName} ${doctor.lastName}`.trim()

  await createInApp(
    doctor.user.id,
    'تم التحقق من حسابك',
    'تهانينا! تمت الموافقة على طلبك. يمكنك الآن استقبال المرضى.',
    'DOCTOR_APPROVED',
    { doctorId },
  )

  if (doctor.user.email) {
    sendDoctorApprovedEmail(doctor.user.email, name).catch(err =>
      console.error('[notifications] doctor approved email failed:', err),
    )
  }

  const facilityUsers = new Map<string, { userId: string; email: string | null; facilityName: string }>()
  for (const link of doctor.facilities) {
    const f = link.facility
    if (f?.user && !facilityUsers.has(f.user.id)) {
      facilityUsers.set(f.user.id, {
        userId:       f.user.id,
        email:        f.user.email,
        facilityName: f.name,
      })
    }
  }

  for (const { userId, email, facilityName } of facilityUsers.values()) {
    await createInApp(
      userId,
      'طبيب معتمد في منشأتك',
      `تم اعتماد الدكتور ${name} ويمكنه الآن العمل ضمن ${facilityName}.`,
      'FACILITY_DOCTOR_APPROVED',
      { doctorId, doctorName: name },
    )
    if (email) {
      sendFacilityDoctorApprovedEmail(email, facilityName, name).catch(err =>
        console.error('[notifications] facility email failed:', err),
      )
    }
  }
}

/** عند رفض الطبيب */
export async function notifyDoctorRejected(doctorId: string, reason?: string) {
  const doctor = await prisma.doctorProfile.findUnique({
    where:  { id: doctorId },
    select: {
      user: { select: { id: true } },
      firstName: true, lastName: true,
    },
  })
  if (!doctor?.user) return

  await createInApp(
    doctor.user.id,
    'تم رفض طلب التحقق',
    reason ? `سبب الرفض: ${reason}` : 'تم رفض طلب التحقق. تواصل مع الدعم لمزيد من المعلومات.',
    'DOCTOR_REJECTED',
    { doctorId },
  )
}

/** منشور طبي جديد بانتظار المراجعة → إشعار للأدمن */
export async function notifyAdminsPublicationPendingReview(
  publicationId: string,
  doctorId: string,
  title: string,
) {
  const doctor = await prisma.doctorProfile.findUnique({
    where:  { id: doctorId },
    select: { firstName: true, lastName: true },
  })
  const name = doctor ? `د. ${doctor.firstName} ${doctor.lastName}`.trim() : 'طبيب'

  const admins = await prisma.user.findMany({
    where: {
      role:      { in: [Role.ADMIN, Role.OWNER] },
      isActive:  true,
      deletedAt: null,
    },
    select: { id: true },
  })
  if (admins.length === 0) return

  await prisma.notification.createMany({
    data: admins.map(a => ({
      userId: a.id,
      title:  '📝 منشور جديد بانتظار المراجعة',
      body:   `${name} أرسل منشوراً: «${title.slice(0, 80)}»`,
      type:   'PUBLICATION_PENDING_REVIEW',
      data:   { publicationId, doctorId },
    })),
  })
}

export async function notifyDoctorPublicationApproved(
  userId: string,
  publicationId: string,
  title: string,
) {
  await createInApp(
    userId,
    '✅ تمت الموافقة على منشورك',
    `تم نشر منشورك «${title.slice(0, 80)}» بعد مراجعة الإدارة.`,
    'PUBLICATION_APPROVED',
    { publicationId },
  )
}

export async function notifyDoctorPublicationRejected(
  userId: string,
  publicationId: string,
  title: string,
  notes?: string,
) {
  await createInApp(
    userId,
    '❌ تم رفض المنشور',
    notes
      ? `تم رفض منشورك «${title.slice(0, 60)}». السبب: ${notes}`
      : `تم رفض منشورك «${title.slice(0, 60)}». يمكنك تعديله وإعادة الإرسال.`,
    'PUBLICATION_REJECTED',
    { publicationId, notes: notes ?? null },
  )
}

/** طلب تحقق عالي المخاطرة أو مستندات مشبوهة → إشعار للأدمن */
export async function notifyAdminsVerificationRiskAlert(params: {
  doctorId: string
  sessionId: string
  doctorName: string
  riskLevel: string
  riskScore: number
  reasons: string[]
}) {
  const admins = await prisma.user.findMany({
    where: {
      role:      { in: [Role.ADMIN, Role.OWNER] },
      isActive:  true,
      deletedAt: null,
    },
    select: { id: true },
  })
  if (admins.length === 0) return

  const reasonText = params.reasons.slice(0, 3).join(' · ') || 'مراجعة عاجلة'
  const title =
    params.riskLevel === 'HIGH'
      ? '🚨 طلب تحقق — مخاطرة عالية'
      : '⚠️ طلب تحقق — يحتاج مراجعة'

  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      title,
      body:   `${params.doctorName} · درجة ${params.riskScore} (${params.riskLevel}). ${reasonText}`,
      type:   'VERIFICATION_RISK_ALERT',
      data:   {
        doctorId:  params.doctorId,
        sessionId: params.sessionId,
        riskLevel: params.riskLevel,
        riskScore: params.riskScore,
        reasons:   params.reasons,
      },
    })),
  })
}

/** إسناد طلب تحقق لمراجع → إشعار للمراجع المُسنَد */
export async function notifyReviewerAssigned(params: {
  assigneeId: string
  sessionId: string
  doctorName: string
  assignedByEmail?: string | null
}) {
  const by = params.assignedByEmail ? ` (من ${params.assignedByEmail})` : ''
  await createInApp(
    params.assigneeId,
    '📋 طلب تحقق مُسنَد إليك',
    `تم إسناد مراجعة ${params.doctorName} إليك${by}.`,
    'VERIFICATION_ASSIGNED',
    { sessionId: params.sessionId, doctorName: params.doctorName },
  )
}
