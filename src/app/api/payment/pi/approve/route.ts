// src/app/api/payment/pi/approve/route.ts
import { NextRequest } from 'next/server'
import { Role, InstantConsultStatus, AdPlan } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { piPaymentService } from '@/infrastructure/pi-network/pi-payment.service'
import { splitDoctorPayment, splitPremioPayment } from '@/lib/payment/platform-fee'
import { getPiNetworkApiKey, PI_PAYMENTS_NOT_CONFIGURED_MSG } from '@/lib/pi/pi-api-key'
import { getAdSettings } from '@/lib/ads/settings'
import { adPlanPrice } from '@/lib/ads/pricing'
import { PaidAdStatus } from '@prisma/client'

import { z } from 'zod'

const ApproveSchema = z.object({
  paymentId:     z.string().min(1),
  purpose:       z.enum(['PREMIO', 'APPOINTMENT', 'INSTANT_CONSULT', 'PAID_AD']),
  amount:        z.number().positive(),
  planType:      z.enum(['MONTHLY', 'YEARLY', 'LIFETIME']).optional(),
  appointmentId: z.string().uuid().optional(),
  instantConsultId: z.string().uuid().optional(),
  adId:          z.string().uuid().optional(),
  adPlan:        z.nativeEnum(AdPlan).optional(),
  paymentType:   z.enum(['FULL', 'DEPOSIT']).optional(),
})

function txNotes(payload: Record<string, unknown>) {
  return JSON.stringify(payload)
}

export async function POST(req: NextRequest) {
  try {
    if (!getPiNetworkApiKey()) {
      return ok({ error: true, message: PI_PAYMENTS_NOT_CONFIGURED_MSG })
    }

    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = ApproveSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { paymentId, purpose, amount, planType, appointmentId, instantConsultId, adId, adPlan, paymentType } = parsed.data

    const existing = await prisma.transaction.findFirst({
      where: { notes: { contains: paymentId }, status: { in: ['PENDING', 'COMPLETED'] } },
    })
    if (existing?.status === 'COMPLETED') {
      return ok({ message: 'تمت معالجة هذا الدفع مسبقاً' })
    }
    if (existing?.status === 'PENDING') {
      await piPaymentService.approvePayment(paymentId)
      return ok({ message: 'تمت الموافقة على الدفع' })
    }

    let transactionType: 'PREMIO_PURCHASE' | 'APPOINTMENT_FEE' | 'DEPOSIT' | 'FINAL_PAYMENT' | 'INSTANT_CONSULT' | 'PAID_AD' = 'PREMIO_PURCHASE'
    let doctorId: string | undefined
    let meta: Record<string, unknown> = { piPaymentId: paymentId, purpose }

    if (purpose === 'PREMIO') {
      if (auth.context.role !== Role.DOCTOR && auth.context.role !== Role.FACILITY) {
        return ok({ error: true, message: 'غير مصرح' })
      }
      if (!planType) return ok({ error: true, message: 'نوع الخطة مطلوب' })

      const settings = await prisma.premioSettings.findFirst()
      if (!settings) return ok({ error: true, message: 'لم يتم تعيين أسعار البريميو' })

      const expected =
        planType === 'MONTHLY' ? Number(settings.monthlyPrice) :
        planType === 'YEARLY' ? Number(settings.yearlyPrice) :
        Number(settings.lifetimePrice)

      if (Math.abs(expected - amount) > 0.0001) {
        return ok({ error: true, message: 'مبلغ الدفع لا يطابق سعر الخطة' })
      }

      meta.planType = planType
    }

    if (purpose === 'APPOINTMENT') {
      if (auth.context.role !== Role.CLIENT) {
        return ok({ error: true, message: 'غير مصرح' })
      }
      if (!appointmentId || !paymentType) {
        return ok({ error: true, message: 'بيانات الموعد ناقصة' })
      }

      const appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, clientId: auth.context.userId, deletedAt: null },
        include: { doctor: { select: { id: true, depositPercentage: true, consultationFee: true } } },
      })
      if (!appointment) return ok({ error: true, message: 'الموعد غير موجود' })
      if (appointment.isPaid) return ok({ error: true, message: 'تم دفع هذا الموعد مسبقاً' })

      const fee = Number(appointment.fee ?? appointment.doctor?.consultationFee ?? 0)
      if (fee <= 0) return ok({ error: true, message: 'لم يتم تحديد رسوم الموعد' })

      let expected = fee
      if (paymentType === 'DEPOSIT' && appointment.doctor) {
        expected = fee * (Number(appointment.doctor.depositPercentage) / 100)
        transactionType = 'DEPOSIT'
      } else if (paymentType === 'FULL' && appointment.isDepositPaid) {
        expected = fee - Number(appointment.depositAmount ?? 0)
        transactionType = 'FINAL_PAYMENT'
      } else {
        transactionType = 'APPOINTMENT_FEE'
      }

      if (Math.abs(expected - amount) > 0.0001) {
        return ok({ error: true, message: 'مبلغ الدفع لا يطابق رسوم الموعد' })
      }

      doctorId = appointment.doctorId ?? undefined
      meta.appointmentId = appointmentId
      meta.paymentType = paymentType
      meta.transactionType = transactionType
    }

    if (purpose === 'INSTANT_CONSULT') {
      if (auth.context.role !== Role.CLIENT) {
        return ok({ error: true, message: 'غير مصرح' })
      }
      if (!instantConsultId) {
        return ok({ error: true, message: 'معرف الاستشارة الفورية مطلوب' })
      }

      const profile = await prisma.clientProfile.findUnique({
        where: { userId: auth.context.userId },
        select: { id: true },
      })
      if (!profile) return ok({ error: true, message: 'ملف المريض غير موجود' })

      const consult = await prisma.instantConsultRequest.findFirst({
        where: {
          id: instantConsultId,
          clientId: profile.id,
          status: InstantConsultStatus.AWAITING_PAYMENT,
        },
      })
      if (!consult) return ok({ error: true, message: 'طلب الاستشارة غير موجود' })

      const expected = Number(consult.fee)
      if (Math.abs(expected - amount) > 0.0001) {
        return ok({ error: true, message: 'مبلغ الدفع لا يطابق رسوم الاستشارة' })
      }

      doctorId = consult.doctorId
      transactionType = 'INSTANT_CONSULT'
      meta.instantConsultId = instantConsultId
      meta.transactionType = transactionType
    }

    if (purpose === 'PAID_AD') {
      if (!adId || !adPlan) {
        return ok({ error: true, message: 'بيانات الإعلان ناقصة' })
      }

      const ad = await prisma.paidAdvertisement.findFirst({
        where: {
          id: adId,
          requesterUserId: auth.context.userId,
          status: PaidAdStatus.PENDING_PAYMENT,
        },
      })
      if (!ad) return ok({ error: true, message: 'طلب الإعلان غير موجود أو مدفوع مسبقاً' })

      const settings = await getAdSettings()
      const expected = adPlanPrice(settings, adPlan)
      if (Math.abs(expected - amount) > 0.0001) {
        return ok({ error: true, message: 'مبلغ الدفع لا يطابق سعر الإعلان' })
      }

      transactionType = 'PAID_AD'
      meta.adId = adId
      meta.adPlan = adPlan
    }

    const { platformFee, receiverAmount } =
      purpose === 'APPOINTMENT' || purpose === 'INSTANT_CONSULT'
        ? splitDoctorPayment(amount)
        : splitPremioPayment(amount)

    await piPaymentService.approvePayment(paymentId)

    await prisma.transaction.create({
      data: {
        userId:         auth.context.userId,
        doctorId,
        appointmentId: purpose === 'APPOINTMENT' ? appointmentId : undefined,
        type:           transactionType,
        status:         'PENDING',
        amountTotal:    amount,
        platformFee,
        receiverAmount,
        notes:          txNotes(meta),
      },
    })

    return ok({ message: 'تمت الموافقة على الدفع' })
  } catch (err) {
    console.error('[POST /api/payment/pi/approve]', err)
    return serverError()
  }
}
