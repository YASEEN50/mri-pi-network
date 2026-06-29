import { InstantConsultStatus, TransactionStatus, TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fulfillInstantConsultPayment } from '@/lib/payment/fulfill'

export async function getClientPiCreditBalance(userId: string): Promise<number> {
  const profile = await prisma.clientProfile.findUnique({
    where: { userId },
    select: { piCreditBalance: true },
  })
  return Number(profile?.piCreditBalance ?? 0)
}

function txNotes(payload: Record<string, unknown>) {
  return JSON.stringify(payload)
}

/** Apply platform π credit toward an instant consult awaiting payment. */
export async function applyCreditToInstantConsult(
  instantConsultId: string,
  clientUserId: string,
): Promise<
  | { ok: true; creditUsed: number; piRemaining: number; fullyPaid: boolean }
  | { ok: false; message: string }
> {
  const profile = await prisma.clientProfile.findUnique({
    where: { userId: clientUserId },
    select: { id: true, piCreditBalance: true },
  })
  if (!profile) return { ok: false, message: 'ملف المريض غير موجود' }

  const consult = await prisma.instantConsultRequest.findFirst({
    where: {
      id: instantConsultId,
      clientId: profile.id,
      status: InstantConsultStatus.AWAITING_PAYMENT,
    },
  })
  if (!consult) return { ok: false, message: 'طلب الاستشارة غير موجود' }

  const fee = Number(consult.fee)
  const alreadyApplied = Number(consult.creditApplied)
  if (alreadyApplied > 0) {
    return {
      ok: true,
      creditUsed: alreadyApplied,
      piRemaining: Math.max(0, fee - alreadyApplied),
      fullyPaid: alreadyApplied >= fee,
    }
  }

  const balance = Number(profile.piCreditBalance)
  const creditUsed = Math.min(balance, fee)
  if (creditUsed <= 0) {
    return { ok: true, creditUsed: 0, piRemaining: fee, fullyPaid: false }
  }

  const piRemaining = fee - creditUsed

  await prisma.$transaction(async (db) => {
    await db.clientProfile.update({
      where: { id: profile.id },
      data: { piCreditBalance: { decrement: creditUsed } },
    })
    await db.instantConsultRequest.update({
      where: { id: instantConsultId },
      data: { creditApplied: creditUsed },
    })
  })

  if (piRemaining <= 0.0001) {
    const tx = await prisma.transaction.create({
      data: {
        userId: clientUserId,
        doctorId: consult.doctorId ?? undefined,
        type: TransactionType.INSTANT_CONSULT,
        status: TransactionStatus.COMPLETED,
        amountTotal: creditUsed,
        platformFee: 0,
        receiverAmount: creditUsed,
        notes: txNotes({
          purpose: 'INSTANT_CONSULT',
          instantConsultId,
          paidWithCredit: true,
        }),
      },
    })
    await fulfillInstantConsultPayment(instantConsultId, clientUserId, fee, tx.id)
    return { ok: true, creditUsed, piRemaining: 0, fullyPaid: true }
  }

  return { ok: true, creditUsed, piRemaining, fullyPaid: false }
}

export function instantConsultPiAmountDue(fee: number, creditApplied: number): number {
  return Math.max(0, fee - creditApplied)
}
