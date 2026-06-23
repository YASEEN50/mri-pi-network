// src/app/api/payment/pi/complete/route.ts
import { NextRequest } from 'next/server'
import { PremioType } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { piPaymentService } from '@/infrastructure/pi-network/pi-payment.service'
import { fulfillPremioPurchase, fulfillAppointmentPayment } from '@/lib/payment/fulfill'
import { settleDoctorPayment } from '@/lib/payment/platform-fee'
import { getPiNetworkApiKey } from '@/lib/pi/pi-api-key'

import { z } from 'zod'

const CompleteSchema = z.object({
  paymentId: z.string().min(1),
  txid:        z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    if (!getPiNetworkApiKey()) {
      return ok({ error: true, message: 'PI_NETWORK_API_KEY غير مُعدّ على الخادم' })
    }

    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = CompleteSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { paymentId, txid } = parsed.data

    const transaction = await prisma.transaction.findFirst({
      where: {
        userId: auth.context.userId,
        notes:  { contains: paymentId },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!transaction) {
      return ok({ error: true, message: 'لم يُعثر على عملية الدفع. أعد المحاولة.' })
    }

    if (transaction.status === 'COMPLETED') {
      return ok({ message: 'تم إتمام الدفع مسبقاً', transactionId: transaction.id })
    }

    await piPaymentService.completePayment(paymentId, txid)

    const meta = JSON.parse(transaction.notes ?? '{}') as {
      purpose?: string
      planType?: PremioType
      appointmentId?: string
      paymentType?: 'FULL' | 'DEPOSIT'
      transactionType?: 'APPOINTMENT_FEE' | 'DEPOSIT' | 'FINAL_PAYMENT'
    }

    await prisma.transaction.update({
      where: { id: transaction.id },
      data:  { status: 'COMPLETED', txHash: txid },
    })

    // تسوية مستحقات الطبيب: 95% تلقائياً لرصيده، 5% عمولة المنصة
    if (meta.purpose === 'APPOINTMENT' && transaction.doctorId) {
      await settleDoctorPayment(transaction)
    }

    if (meta.purpose === 'PREMIO' && meta.planType) {
      const premio = await fulfillPremioPurchase(
        auth.context.userId,
        meta.planType,
        Number(transaction.amountTotal),
        txid,
        transaction.id,
      )
      return ok({
        message:  'تم الدفع وتفعيل البريميو بنجاح 💎',
        premioId: premio.id,
        txHash:   txid,
      })
    }

    if (meta.purpose === 'APPOINTMENT' && meta.appointmentId && meta.paymentType) {
      await fulfillAppointmentPayment(
        meta.appointmentId,
        meta.paymentType,
        meta.transactionType ?? 'APPOINTMENT_FEE',
        auth.context.userId,
        Number(transaction.amountTotal),
        transaction.id,
        Number(transaction.platformFee),
        Number(transaction.receiverAmount),
      )
      return ok({
        message:       'تم الدفع بنجاح',
        appointmentId: meta.appointmentId,
        txHash:        txid,
      })
    }

    return ok({ error: true, message: 'نوع الدفع غير معروف' })
  } catch (err) {
    console.error('[POST /api/payment/pi/complete]', err)
    return ok({ error: true, message: 'فشل إتمام الدفع عبر Pi Network' })
  }
}
