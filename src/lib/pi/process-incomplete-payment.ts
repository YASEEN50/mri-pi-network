import { Role, PremioType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { piPaymentService } from '@/infrastructure/pi-network/pi-payment.service'
import { splitDoctorPayment, splitPremioPayment, settleDoctorPayment } from '@/lib/payment/platform-fee'
import { fulfillPremioPurchase, fulfillAppointmentPayment } from '@/lib/payment/fulfill'
import type { PiPaymentDto } from '@/lib/pi/pi-payment-dto'

function txNotes(payload: Record<string, unknown>) {
  return JSON.stringify(payload)
}

function parseNotes(notes: string | null) {
  try {
    return JSON.parse(notes ?? '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function processIncompletePiPayment(
  userId: string,
  role: Role,
  payment: PiPaymentDto,
): Promise<{ message: string }> {
  if (payment.status.cancelled || payment.status.user_cancelled) {
    return { message: 'الدفع ملغى' }
  }

  const paymentId = payment.identifier
  const purpose = payment.metadata.purpose as string | undefined

  let transaction = await prisma.transaction.findFirst({
    where: { userId, notes: { contains: paymentId } },
    orderBy: { createdAt: 'desc' },
  })

  if (!payment.status.developer_approved) {
    if (!transaction) {
      transaction = await createPendingTransaction(userId, role, payment)
    }
    await piPaymentService.approvePayment(paymentId)
    return { message: 'تمت موافقة الدفع المعلق' }
  }

  const txid = payment.transaction?.txid
  if (txid && !payment.status.developer_completed) {
    if (!transaction) {
      transaction = await createPendingTransaction(userId, role, payment)
      await piPaymentService.approvePayment(paymentId)
    }

    if (transaction.status === 'COMPLETED') {
      return { message: 'تم إتمام الدفع مسبقاً' }
    }

    await piPaymentService.completePayment(paymentId, txid)

    const meta = parseNotes(transaction.notes) as {
      purpose?: string
      planType?: PremioType
      appointmentId?: string
      paymentType?: 'FULL' | 'DEPOSIT'
      transactionType?: 'APPOINTMENT_FEE' | 'DEPOSIT' | 'FINAL_PAYMENT'
    }

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'COMPLETED', txHash: txid },
    })

    if (meta.purpose === 'APPOINTMENT' && transaction.doctorId) {
      await settleDoctorPayment(transaction)
    }

    if (meta.purpose === 'PREMIO' && meta.planType) {
      await fulfillPremioPurchase(
        userId,
        meta.planType,
        Number(transaction.amountTotal),
        txid,
        transaction.id,
      )
      return { message: 'تم إكمال دفع البريميو المعلق' }
    }

    if (meta.purpose === 'APPOINTMENT' && meta.appointmentId && meta.paymentType) {
      await fulfillAppointmentPayment(
        meta.appointmentId,
        meta.paymentType,
        meta.transactionType ?? 'APPOINTMENT_FEE',
        userId,
        Number(transaction.amountTotal),
        transaction.id,
        Number(transaction.platformFee),
        Number(transaction.receiverAmount),
      )
      return { message: 'تم إكمال دفع الموعد المعلق' }
    }

    return { message: 'تم إكمال الدفع المعلق' }
  }

  if (transaction?.status === 'COMPLETED') {
    return { message: 'الدفع مكتمل' }
  }

  return { message: purpose === 'PREMIO' ? 'لا يوجد دفع بريميو معلق للإكمال' : 'تمت معالجة الدفع المعلق' }
}

async function createPendingTransaction(userId: string, role: Role, payment: PiPaymentDto) {
  const paymentId = payment.identifier
  const purpose = payment.metadata.purpose as string | undefined
  const amount = payment.amount

  if (purpose === 'PREMIO') {
    if (role !== Role.DOCTOR && role !== Role.FACILITY) {
      throw new Error('غير مصرح')
    }
    const planType = payment.metadata.planType as PremioType | undefined
    if (!planType) throw new Error('نوع خطة البريميو مطلوب')

    const settings = await prisma.premioSettings.findFirst()
    if (!settings) throw new Error('لم يتم تعيين أسعار البريميو')

    const expected =
      planType === 'MONTHLY' ? Number(settings.monthlyPrice) :
      planType === 'YEARLY' ? Number(settings.yearlyPrice) :
      Number(settings.lifetimePrice)

    if (Math.abs(expected - amount) > 0.0001) {
      throw new Error('مبلغ الدفع لا يطابق سعر خطة البريميو')
    }

    const { platformFee, receiverAmount } = splitPremioPayment(amount)
    return prisma.transaction.create({
      data: {
        userId,
        type: 'PREMIO_PURCHASE',
        status: 'PENDING',
        amountTotal: amount,
        platformFee,
        receiverAmount,
        notes: txNotes({ piPaymentId: paymentId, purpose: 'PREMIO', planType }),
      },
    })
  }

  if (purpose === 'APPOINTMENT') {
    if (role !== Role.CLIENT) throw new Error('غير مصرح')
    const appointmentId = payment.metadata.appointmentId as string | undefined
    const paymentType = payment.metadata.paymentType as 'FULL' | 'DEPOSIT' | undefined
    if (!appointmentId || !paymentType) throw new Error('بيانات الموعد ناقصة')

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, clientId: userId, deletedAt: null },
      include: { doctor: { select: { id: true, depositPercentage: true, consultationFee: true } } },
    })
    if (!appointment) throw new Error('الموعد غير موجود')

    const fee = Number(appointment.fee ?? appointment.doctor?.consultationFee ?? 0)
    let transactionType: 'APPOINTMENT_FEE' | 'DEPOSIT' | 'FINAL_PAYMENT' = 'APPOINTMENT_FEE'
    let expected = fee

    if (paymentType === 'DEPOSIT' && appointment.doctor) {
      expected = fee * (Number(appointment.doctor.depositPercentage) / 100)
      transactionType = 'DEPOSIT'
    } else if (paymentType === 'FULL' && appointment.isDepositPaid) {
      expected = fee - Number(appointment.depositAmount ?? 0)
      transactionType = 'FINAL_PAYMENT'
    }

    if (Math.abs(expected - amount) > 0.0001) {
      throw new Error('مبلغ الدفع لا يطابق رسوم الموعد')
    }

    const { platformFee, receiverAmount } = splitDoctorPayment(amount)
    return prisma.transaction.create({
      data: {
        userId,
        doctorId: appointment.doctorId ?? undefined,
        appointmentId,
        type: transactionType,
        status: 'PENDING',
        amountTotal: amount,
        platformFee,
        receiverAmount,
        notes: txNotes({
          piPaymentId: paymentId,
          purpose: 'APPOINTMENT',
          appointmentId,
          paymentType,
          transactionType,
        }),
      },
    })
  }

  throw new Error('نوع الدفع غير معروف في metadata')
}
