// src/app/api/payment/pi/approve/route.ts
import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { piPaymentService } from '@/infrastructure/pi-network/pi-payment.service'
import { splitDoctorPayment, splitPremioPayment } from '@/lib/payment/platform-fee'
import { z } from 'zod'

const ApproveSchema = z.object({
  paymentId:     z.string().min(1),
  purpose:       z.enum(['PREMIO', 'APPOINTMENT']),
  amount:        z.number().positive(),
  planType:      z.enum(['MONTHLY', 'YEARLY', 'LIFETIME']).optional(),
  appointmentId: z.string().uuid().optional(),
  paymentType:   z.enum(['FULL', 'DEPOSIT']).optional(),
})

function txNotes(payload: Record<string, unknown>) {
  return JSON.stringify(payload)
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = ApproveSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { paymentId, purpose, amount, planType, appointmentId, paymentType } = parsed.data

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

    let transactionType: 'PREMIO_PURCHASE' | 'APPOINTMENT_FEE' | 'DEPOSIT' | 'FINAL_PAYMENT' = 'PREMIO_PURCHASE'
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

    const { platformFee, receiverAmount } =
      purpose === 'APPOINTMENT' ? splitDoctorPayment(amount) : splitPremioPayment(amount)

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
