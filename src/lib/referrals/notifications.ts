import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { REFERRAL_REWARD_PI } from '@/lib/referrals/config'

async function createNotification(
  userId: string,
  title: string,
  body: string,
  type: string,
  data: Prisma.InputJsonValue,
) {
  await prisma.notification.create({
    data: { userId, title, body, type, data },
  })
}

export async function notifyReferralCreated(referralId: string) {
  const ref = await prisma.referral.findUnique({
    where: { id: referralId },
    include: {
      fromDoctor: { select: { firstName: true, lastName: true } },
      toDoctor: { select: { userId: true, firstName: true, lastName: true } },
    },
  })
  if (!ref?.toDoctor?.userId) return

  const fromName = `د. ${ref.fromDoctor.firstName} ${ref.fromDoctor.lastName}`
  await createNotification(
    ref.toDoctor.userId,
    '📋 إحالة مريض جديدة',
    `${fromName} أحال إليك مريضاً. السبب: ${ref.reason}`,
    'REFERRAL_RECEIVED',
    { referralId, fromDoctorId: ref.fromDoctorId },
  )
}

export async function notifyReferralAccepted(referralId: string) {
  const ref = await prisma.referral.findUnique({
    where: { id: referralId },
    include: {
      fromDoctor: { select: { userId: true } },
      toDoctor: { select: { firstName: true, lastName: true } },
    },
  })
  if (!ref?.fromDoctor?.userId) return

  const toName = `د. ${ref.toDoctor.firstName} ${ref.toDoctor.lastName}`
  await createNotification(
    ref.fromDoctor.userId,
    '✅ تم قبول الإحالة',
    `${toName} قبل إحالة المريض.`,
    'REFERRAL_ACCEPTED',
    { referralId },
  )
}

export async function notifyReferralCompleted(referralId: string, rewardPi: number) {
  const ref = await prisma.referral.findUnique({
    where: { id: referralId },
    include: {
      fromDoctor: { select: { userId: true } },
      toDoctor: { select: { firstName: true, lastName: true } },
    },
  })
  if (!ref?.fromDoctor?.userId) return

  const toName = `د. ${ref.toDoctor.firstName} ${ref.toDoctor.lastName}`
  await createNotification(
    ref.fromDoctor.userId,
    '🎁 مكافأة إحالة',
    `اكتملت إحالتك مع ${toName}. تم إضافة ${rewardPi} π إلى رصيدك.`,
    'REFERRAL_REWARD',
    { referralId, rewardPi },
  )
}

export async function notifyReferralCancelled(referralId: string, cancelledByUserId: string) {
  const ref = await prisma.referral.findUnique({
    where: { id: referralId },
    include: {
      fromDoctor: { select: { userId: true, firstName: true, lastName: true } },
      toDoctor: { select: { userId: true, firstName: true, lastName: true } },
    },
  })
  if (!ref) return

  const notifyUserId =
    cancelledByUserId === ref.fromDoctor.userId
      ? ref.toDoctor.userId
      : ref.fromDoctor.userId
  if (!notifyUserId) return

  await createNotification(
    notifyUserId,
    '❌ إلغاء إحالة',
    'تم إلغاء إحالة مريض.',
    'REFERRAL_CANCELLED',
    { referralId },
  )
}

export { REFERRAL_REWARD_PI }
