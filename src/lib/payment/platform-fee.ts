// src/lib/payment/platform-fee.ts
// عمولة المنصة 5% تُخصم تلقائياً من مستحقات الطبيب

import { prisma } from '@/lib/prisma'

/** نسبة عمولة المنصة من مدفوعات الطبيب */
export const PLATFORM_FEE_RATE = 0.05

function roundPi(n: number): number {
  return Math.round(n * 10000) / 10000
}

/** تقسيم مبلغ موعد/استشارة: 5% للمنصة، 95% للطبيب */
export function splitDoctorPayment(amount: number) {
  const platformFee = roundPi(amount * PLATFORM_FEE_RATE)
  const receiverAmount = roundPi(amount - platformFee)
  return { platformFee, receiverAmount }
}

/** اشتراك البريميو — كامل المبلغ للمنصة */
export function splitPremioPayment(amount: number) {
  return { platformFee: roundPi(amount), receiverAmount: 0 }
}

/**
 * بعد اكتمال الدفع: إضافة حصة الطبيب (95%) لرصيده وإشعاره.
 * عمولة 5% تبقى مسجّلة في المعاملة لحساب المنصة.
 */
export async function settleDoctorPayment(transaction: {
  id: string
  doctorId: string | null
  receiverAmount: { toString(): string } | number
  platformFee: { toString(): string } | number
  amountTotal: { toString(): string } | number
}): Promise<void> {
  if (!transaction.doctorId) return

  const receiver = Number(transaction.receiverAmount)
  const fee = Number(transaction.platformFee)
  const total = Number(transaction.amountTotal)

  if (receiver <= 0) return

  const doctor = await prisma.doctorProfile.update({
    where: { id: transaction.doctorId },
    data:  { piBalance: { increment: receiver } },
    select: { userId: true, piBalance: true },
  })

  await prisma.notification.create({
    data: {
      userId: doctor.userId,
      title: '💰 مستحقات جديدة',
      body:  `أُضيف ${receiver.toFixed(4)} π لرصيدك. خُصمت عمولة المنصة (${(PLATFORM_FEE_RATE * 100).toFixed(0)}%): ${fee.toFixed(4)} π من ${total.toFixed(4)} π.`,
      type:  'DOCTOR_PAYMENT_SETTLED',
      data:  {
        transactionId:  transaction.id,
        receiverAmount: receiver,
        platformFee:    fee,
        amountTotal:    total,
      },
    },
  })
}
