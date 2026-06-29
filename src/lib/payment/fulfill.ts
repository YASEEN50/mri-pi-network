// src/lib/payment/fulfill.ts
// تنفيذ الطلب بعد اكتمال دفع Pi

import { prisma } from '@/lib/prisma'
import { InstantConsultStatus, PremioType } from '@prisma/client'
import {
  acceptDeadlineFromNow,
  notifyDoctorInstantRequest,
  notifyDoctorsBroadcast,
} from '@/lib/instant-consult/service'
import { linkInstantConsultTransaction } from '@/lib/payment/instant-consult-escrow'

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

export async function fulfillInstantConsultPayment(
  instantConsultId: string,
  clientUserId: string,
  amountPaid: number,
  transactionId: string,
) {
  const request = await prisma.instantConsultRequest.findUnique({
    where: { id: instantConsultId },
    include: {
      client: { select: { userId: true, firstName: true, lastName: true } },
      doctor: { select: { userId: true, firstName: true, lastName: true } },
    },
  })
  if (!request || request.status !== InstantConsultStatus.AWAITING_PAYMENT) {
    throw new Error('طلب الاستشارة غير صالح للدفع')
  }

  const now = new Date()
  await prisma.instantConsultRequest.update({
    where: { id: instantConsultId },
    data: {
      isPaid: true,
      paidAt: now,
      status: InstantConsultStatus.PENDING,
      expiresAt: acceptDeadlineFromNow(),
    },
  })

  const clientName = `${request.client.firstName} ${request.client.lastName}`

  if (request.isBroadcast && request.targetSpecialization) {
    await notifyDoctorsBroadcast(request.targetSpecialization, instantConsultId, clientName)
  } else if (request.doctor) {
    await notifyDoctorInstantRequest(request.doctor.userId, instantConsultId, clientName)
  }

  await linkInstantConsultTransaction(instantConsultId, transactionId)

  const doctorLabel = request.doctor
    ? `د. ${request.doctor.firstName} ${request.doctor.lastName}`
    : request.targetSpecialization ?? 'الأطباء المتاحين'

  await prisma.notification.create({
    data: {
      userId: clientUserId,
      title: '⏳ بانتظار الطبيب',
      body: `تم الدفع ${amountPaid.toFixed(4)} π — بانتظار قبول ${doctorLabel}`,
      type: 'INSTANT_CONSULT_PENDING',
      data: { instantConsultId, transactionId },
    },
  })
}
