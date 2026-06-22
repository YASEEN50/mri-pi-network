// src/lib/payment/fulfill.ts
// تنفيذ الطلب بعد اكتمال دفع Pi

import { prisma } from '@/lib/prisma'
import { PremioType } from '@prisma/client'

export async function fulfillPremioPurchase(
  userId: string,
  planType: PremioType,
  price: number,
  txHash: string,
  transactionId: string,
) {
  const now = new Date()
  let expiryDate: Date | null = null
  if (planType === 'MONTHLY') {
    expiryDate = new Date(now)
    expiryDate.setMonth(expiryDate.getMonth() + 1)
  } else if (planType === 'YEARLY') {
    expiryDate = new Date(now)
    expiryDate.setFullYear(expiryDate.getFullYear() + 1)
  }

  await prisma.premio.updateMany({
    where: { userId, status: 'ACTIVE' },
    data:  { status: 'CANCELLED' },
  })

  const premio = await prisma.premio.create({
    data: {
      userId,
      type:       planType,
      status:     'ACTIVE',
      startDate:  now,
      expiryDate,
      pricePaid:  price,
      txHash,
    },
  })

  await prisma.notification.create({
    data: {
      userId,
      title: '💎 مرحباً بك في البريميو!',
      body:  `تم تفعيل اشتراك البريميو بعد الدفع بـ ${price} Pi.`,
      type:  'PREMIO_ACTIVATED',
      data:  { premioId: premio.id, planType, transactionId },
    },
  })

  return premio
}

export async function fulfillAppointmentPayment(
  appointmentId: string,
  paymentType: 'FULL' | 'DEPOSIT',
  transactionType: 'APPOINTMENT_FEE' | 'DEPOSIT' | 'FINAL_PAYMENT',
  userId: string,
  amountPaid: number,
  transactionId: string,
  platformFee?: number,
  doctorNet?: number,
) {
  if (paymentType === 'FULL' && transactionType === 'APPOINTMENT_FEE') {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data:  { isPaid: true, paidAt: new Date() },
    })
  } else if (transactionType === 'DEPOSIT') {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data:  { isDepositPaid: true, depositAmount: amountPaid },
    })
  } else if (transactionType === 'FINAL_PAYMENT') {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data:  { isPaid: true, paidAt: new Date() },
    })
  }

  const feeNote = platformFee != null && doctorNet != null
    ? ` (عمولة المنصة 5%: ${platformFee.toFixed(4)} π)`
    : ''

  await prisma.notification.create({
    data: {
      userId,
      title: '✅ تم الدفع بنجاح',
      body:  `تم دفع ${amountPaid.toFixed(4)} π بنجاح${feeNote}.`,
      type:  'PAYMENT_COMPLETED',
      data:  { transactionId, appointmentId, platformFee, doctorNet },
    },
  })
}
