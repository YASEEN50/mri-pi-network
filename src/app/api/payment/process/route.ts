// src/app/api/payment/process/route.ts
import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { processPayment } from '@/infrastructure/pi-network/pi-payment.service'
import { z } from 'zod'

const Schema = z.object({
  appointmentId: z.string().uuid(),
  paymentType: z.enum(['FULL', 'DEPOSIT']),
  payerWallet: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.CLIENT] })
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { appointmentId, paymentType, payerWallet } = parsed.data
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, clientId: auth.context.userId, deletedAt: null },
      include: { doctor: { select: { id: true, paymentPolicy: true, depositPercentage: true, consultationFee: true } } },
    })

    if (!appointment) return ok({ error: true, message: 'الموعد غير موجود' })
    if (appointment.isPaid) return ok({ error: true, message: 'تم دفع هذا الموعد مسبقاً' })

    const fee = Number(appointment.fee ?? appointment.doctor?.consultationFee ?? 0)
    if (fee === 0) return ok({ error: true, message: 'لم يتم تحديد رسوم الموعد' })

    let amountToPay = fee
    let transactionType: 'APPOINTMENT_FEE' | 'DEPOSIT' | 'FINAL_PAYMENT' = 'APPOINTMENT_FEE'

    if (paymentType === 'DEPOSIT' && appointment.doctor) {
      amountToPay = fee * (Number(appointment.doctor.depositPercentage) / 100)
      transactionType = 'DEPOSIT'
    } else if (paymentType === 'FULL' && appointment.isDepositPaid) {
      amountToPay = fee - Number(appointment.depositAmount ?? 0)
      transactionType = 'FINAL_PAYMENT'
    }

    const result = await processPayment({ userId: auth.context.userId, doctorId: appointment.doctorId ?? undefined, appointmentId, amountTotal: amountToPay, type: transactionType, memo: `دفع موعد #${appointmentId.slice(0, 8)}`, payerWallet })
    if (!result.success) return ok({ error: true, message: result.error })

    if (paymentType === 'FULL' && transactionType === 'APPOINTMENT_FEE') {
      await prisma.appointment.update({ where: { id: appointmentId }, data: { isPaid: true, paidAt: new Date() } })
    }

    await prisma.notification.create({ data: { userId: auth.context.userId, title: '✅ تم الدفع بنجاح', body: `تم دفع ${amountToPay.toFixed(4)} Pi بنجاح`, type: 'PAYMENT_COMPLETED', data: { transactionId: result.transactionId, appointmentId } } })

    return ok({ transactionId: result.transactionId, txHash: result.txHash, amountPaid: amountToPay, message: 'تم الدفع بنجاح' })
  } catch (err) {
    console.error('[POST /api/payment/process]', err)
    return serverError()
  }
}
