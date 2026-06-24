import { prisma } from '@/lib/prisma'
import { ReferralStatus } from '@prisma/client'
import { REFERRAL_REWARD_PI } from '@/lib/referrals/config'
import { notifyReferralCompleted } from '@/lib/referrals/notifications'

/** Credit referring doctor piBalance and record transaction when referral completes */
export async function awardReferralReward(referralId: string): Promise<number> {
  const ref = await prisma.referral.findUnique({
    where: { id: referralId },
    select: {
      id: true,
      status: true,
      fromDoctorId: true,
      fromDoctor: { select: { userId: true, piBalance: true } },
    },
  })

  if (!ref || ref.status !== ReferralStatus.COMPLETED) {
    throw new Error('Referral not eligible for reward')
  }

  const existing = await prisma.transaction.findFirst({
    where: {
      type: 'REFERRAL_REWARD',
      notes: { contains: referralId },
      status: 'COMPLETED',
    },
  })
  if (existing) return REFERRAL_REWARD_PI

  const reward = REFERRAL_REWARD_PI

  await prisma.$transaction([
    prisma.doctorProfile.update({
      where: { id: ref.fromDoctorId },
      data: { piBalance: { increment: reward } },
    }),
    prisma.transaction.create({
      data: {
        userId: ref.fromDoctor.userId,
        doctorId: ref.fromDoctorId,
        type: 'REFERRAL_REWARD',
        status: 'COMPLETED',
        amountTotal: reward,
        platformFee: 0,
        receiverAmount: reward,
        notes: `referralId:${referralId}`,
      },
    }),
  ])

  await notifyReferralCompleted(referralId, reward)
  return reward
}
