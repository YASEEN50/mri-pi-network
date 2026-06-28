import { PaidAdStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function fulfillPaidAdPayment(
  adId: string,
  userId: string,
  amountPaid: number,
  txHash: string,
  paymentId: string,
  transactionId: string,
) {
  const ad = await prisma.paidAdvertisement.findFirst({
    where: {
      id: adId,
      requesterUserId: userId,
      status: PaidAdStatus.PENDING_PAYMENT,
    },
  })
  if (!ad) throw new Error('طلب الإعلان غير صالح للدفع')

  await prisma.paidAdvertisement.update({
    where: { id: adId },
    data: {
      status: PaidAdStatus.PENDING_REVIEW,
      paidAt: new Date(),
      piPaymentId: paymentId,
      piTxHash: txHash,
      pricePi: amountPaid,
    },
  })

  await prisma.notification.create({
    data: {
      userId,
      title: '✅ تم دفع الإعلان',
      body: `تم استلام ${amountPaid.toFixed(4)} π — طلبك «${ad.title}» بانتظار مراجعة الإدارة.`,
      type: 'PAID_AD_SUBMITTED',
      data: { adId, transactionId },
    },
  })

  const owners = await prisma.user.findMany({
    where: { role: 'OWNER', deletedAt: null },
    select: { id: true },
  })
  await Promise.all(
    owners.map((owner) =>
      prisma.notification.create({
        data: {
          userId: owner.id,
          title: '📢 إعلان مدفوع بانتظار المراجعة',
          body: `«${ad.title}» من ${ad.advertiserName} — ${amountPaid.toFixed(4)} π`,
          type: 'PAID_AD_PENDING_REVIEW',
          data: { adId },
        },
      }).catch(() => {}),
    ),
  )
}
