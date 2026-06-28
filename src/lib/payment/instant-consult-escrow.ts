import { TransactionStatus, TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { settleDoctorPayment } from '@/lib/payment/platform-fee'

function parseNotes(notes: string | null): Record<string, unknown> {
  try {
    return JSON.parse(notes ?? '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

function txNotes(payload: Record<string, unknown>) {
  return JSON.stringify(payload)
}

export async function findInstantConsultTransaction(instantConsultId: string) {
  const request = await prisma.instantConsultRequest.findUnique({
    where: { id: instantConsultId },
    select: { transactionId: true },
  })

  if (request?.transactionId) {
    const byId = await prisma.transaction.findUnique({
      where: { id: request.transactionId },
    })
    if (byId) return byId
  }

  return prisma.transaction.findFirst({
    where: {
      type: TransactionType.INSTANT_CONSULT,
      status: { in: [TransactionStatus.COMPLETED, TransactionStatus.REFUNDED] },
      notes: { contains: instantConsultId },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/** Pay doctor only after the consult is accepted (escrow until accept). */
export async function settleInstantConsultOnAccept(instantConsultId: string): Promise<void> {
  const tx = await findInstantConsultTransaction(instantConsultId)
  if (!tx || tx.status !== TransactionStatus.COMPLETED) return

  const meta = parseNotes(tx.notes)
  if (meta.doctorSettled === true) return

  await settleDoctorPayment(tx)
  await prisma.transaction.update({
    where: { id: tx.id },
    data: { notes: txNotes({ ...meta, doctorSettled: true }) },
  })
}

/**
 * Refund patient platform credit when consult is rejected or expires.
 * Claws back doctor balance if a legacy payment was settled immediately.
 */
export async function refundInstantConsultPayment(
  instantConsultId: string,
): Promise<{ refunded: boolean; amount?: number; already?: boolean }> {
  const request = await prisma.instantConsultRequest.findUnique({
    where: { id: instantConsultId },
    include: { client: { select: { id: true, userId: true } } },
  })
  if (!request?.isPaid) return { refunded: false, already: true }

  const tx = await findInstantConsultTransaction(instantConsultId)
  if (!tx) return { refunded: false }

  const existingRefund = await prisma.transaction.findFirst({
    where: {
      type: TransactionType.REFUND,
      status: TransactionStatus.COMPLETED,
      notes: { contains: instantConsultId },
    },
  })
  if (existingRefund || tx.status === TransactionStatus.REFUNDED) {
    return { refunded: false, already: true }
  }

  const meta = parseNotes(tx.notes)
  const amount = Number(tx.amountTotal)
  const receiver = Number(tx.receiverAmount)

  await prisma.$transaction(async (db) => {
    if (meta.doctorSettled === true && tx.doctorId && receiver > 0) {
      const doctor = await db.doctorProfile.findUnique({
        where: { id: tx.doctorId },
        select: { piBalance: true },
      })
      const clawback = Math.min(receiver, Number(doctor?.piBalance ?? 0))
      if (clawback > 0) {
        await db.doctorProfile.update({
          where: { id: tx.doctorId },
          data: { piBalance: { decrement: clawback } },
        })
      }
    }

    await db.clientProfile.update({
      where: { id: request.clientId },
      data: { piCreditBalance: { increment: amount } },
    })

    await db.transaction.create({
      data: {
        userId: request.client.userId,
        doctorId: tx.doctorId,
        type: TransactionType.REFUND,
        status: TransactionStatus.COMPLETED,
        amountTotal: amount,
        platformFee: 0,
        receiverAmount: amount,
        notes: txNotes({
          purpose: 'INSTANT_CONSULT_REFUND',
          instantConsultId,
          originalTransactionId: tx.id,
        }),
      },
    })

    await db.transaction.update({
      where: { id: tx.id },
      data: { status: TransactionStatus.REFUNDED },
    })
  })

  await prisma.notification.create({
    data: {
      userId: request.client.userId,
      title: '💰 تم استرداد المبلغ',
      body: `أُرجِع ${amount.toFixed(4)} π إلى رصيدك في المنصة — يمكنك استخدامه في حجز أو استشارة لاحقة`,
      type: 'INSTANT_CONSULT_REFUNDED',
      data: { instantConsultId, amount },
    },
  })

  return { refunded: true, amount }
}

export async function linkInstantConsultTransaction(
  instantConsultId: string,
  transactionId: string,
): Promise<void> {
  await prisma.instantConsultRequest.update({
    where: { id: instantConsultId },
    data: { transactionId },
  })
}
