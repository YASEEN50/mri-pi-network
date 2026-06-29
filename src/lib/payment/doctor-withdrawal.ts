import {
  TransactionStatus,
  TransactionType,
  WithdrawalStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { piPaymentService } from '@/infrastructure/pi-network/pi-payment.service'

export const MIN_DOCTOR_WITHDRAWAL_PI = 1

function txNotes(payload: Record<string, unknown>) {
  return JSON.stringify(payload)
}

function roundPi(n: number): number {
  return Math.round(n * 10000) / 10000
}

export function mapWithdrawalRow(r: {
  id: string
  amount: { toString(): string } | number
  status: WithdrawalStatus
  piUsername: string | null
  piPaymentId: string | null
  toAddress: string | null
  txHash: string | null
  rejectionReason: string | null
  createdAt: Date
  reviewedAt: Date | null
  doctor?: {
    firstName: string
    lastName: string
    user: { piUsername: string | null; email: string | null }
  }
}) {
  return {
    id: r.id,
    amount: Number(r.amount),
    status: r.status,
    piUsername: r.piUsername,
    piPaymentId: r.piPaymentId,
    toAddress: r.toAddress,
    txHash: r.txHash,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    doctorName: r.doctor
      ? `د. ${r.doctor.firstName} ${r.doctor.lastName}`
      : undefined,
    doctorContact:
      r.doctor?.user.piUsername ?? r.doctor?.user.email ?? undefined,
  }
}

/** Doctor requests payout from internal piBalance to linked Pi wallet. */
export async function requestDoctorWithdrawal(
  userId: string,
  amountRaw: number,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const amount = roundPi(amountRaw)
  if (amount < MIN_DOCTOR_WITHDRAWAL_PI) {
    return { ok: false, message: `الحد الأدنى للسحب ${MIN_DOCTOR_WITHDRAWAL_PI} π` }
  }

  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      piBalance: true,
      user: { select: { piUid: true, piUsername: true } },
    },
  })
  if (!doctor) return { ok: false, message: 'ملف الطبيب غير موجود' }
  if (!doctor.user.piUid) {
    return {
      ok: false,
      message: 'اربط حساب Pi أولاً من الملف الشخصي (تسجيل دخول عبر Pi Browser)',
    }
  }

  const balance = Number(doctor.piBalance)
  if (amount > balance + 0.0001) {
    return { ok: false, message: `رصيدك المتاح ${balance.toFixed(4)} π فقط` }
  }

  const open = await prisma.withdrawalRequest.findFirst({
    where: {
      doctorId: doctor.id,
      status: { in: [WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING] },
    },
    select: { id: true },
  })
  if (open) {
    return { ok: false, message: 'لديك طلب سحب قيد المعالجة — انتظر اكتماله' }
  }

  const created = await prisma.$transaction(async (db) => {
    const locked = await db.doctorProfile.updateMany({
      where: { id: doctor.id, piBalance: { gte: amount } },
      data: { piBalance: { decrement: amount } },
    })
    if (locked.count === 0) {
      throw new Error('INSUFFICIENT_BALANCE')
    }

    const tx = await db.transaction.create({
      data: {
        userId,
        doctorId: doctor.id,
        type: TransactionType.DOCTOR_WITHDRAWAL,
        status: TransactionStatus.PENDING,
        amountTotal: amount,
        platformFee: 0,
        receiverAmount: amount,
        receiverWallet: doctor.user.piUsername ?? undefined,
        notes: txNotes({ purpose: 'DOCTOR_WITHDRAWAL' }),
      },
    })

    const wr = await db.withdrawalRequest.create({
      data: {
        doctorId: doctor.id,
        userId,
        amount,
        piUid: doctor.user.piUid!,
        piUsername: doctor.user.piUsername,
        transactionId: tx.id,
      },
    })

    await db.transaction.update({
      where: { id: tx.id },
      data: { notes: txNotes({ purpose: 'DOCTOR_WITHDRAWAL', withdrawalId: wr.id }) },
    })

    return wr
  }).catch((err: Error) => {
    if (err.message === 'INSUFFICIENT_BALANCE') return null
    throw err
  })

  if (!created) return { ok: false, message: 'رصيد غير كافٍ' }

  await prisma.notification.create({
    data: {
      userId,
      title: '📤 طلب سحب',
      body: `طلب سحب ${amount.toFixed(4)} π — بانتظار موافقة الإدارة`,
      type: 'WITHDRAWAL_REQUESTED',
      data: { withdrawalId: created.id, amount },
    },
  })

  return { ok: true, id: created.id }
}

/** Admin starts Pi A2U payment (PROCESSING) or completes with blockchain txid. */
export async function processWithdrawalByAdmin(
  withdrawalId: string,
  adminUserId: string,
  action: 'start' | 'complete' | 'reject',
  opts?: { txHash?: string; rejectionReason?: string },
): Promise<
  | { ok: true; status: WithdrawalStatus; toAddress?: string; piPaymentId?: string }
  | { ok: false; message: string }
> {
  const wr = await prisma.withdrawalRequest.findUnique({
    where: { id: withdrawalId },
    include: {
      doctor: { select: { userId: true } },
    },
  })
  if (!wr) return { ok: false, message: 'طلب السحب غير موجود' }

  if (action === 'reject') {
    if (
      wr.status !== WithdrawalStatus.PENDING &&
      wr.status !== WithdrawalStatus.PROCESSING
    ) {
      return { ok: false, message: 'لا يمكن رفض هذا الطلب' }
    }
    const reason = opts?.rejectionReason?.trim() || 'مرفوض من الإدارة'

    await prisma.$transaction(async (db) => {
      await db.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: WithdrawalStatus.REJECTED,
          rejectionReason: reason,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
        },
      })
      await db.doctorProfile.update({
        where: { id: wr.doctorId },
        data: { piBalance: { increment: Number(wr.amount) } },
      })
      if (wr.transactionId) {
        await db.transaction.update({
          where: { id: wr.transactionId },
          data: { status: TransactionStatus.FAILED },
        })
      }
    })

    await prisma.notification.create({
      data: {
        userId: wr.doctor.userId,
        title: '❌ رُفض طلب السحب',
        body: `${reason} — أُعيد ${Number(wr.amount).toFixed(4)} π لرصيدك`,
        type: 'WITHDRAWAL_REJECTED',
        data: { withdrawalId },
      },
    })

    return { ok: true, status: WithdrawalStatus.REJECTED }
  }

  if (action === 'start') {
    if (wr.status !== WithdrawalStatus.PENDING) {
      return { ok: false, message: 'الطلب ليس بانتظار البدء' }
    }

    const amount = Number(wr.amount)
    let piPaymentId = wr.piPaymentId
    let toAddress = wr.toAddress

    if (!piPaymentId) {
      const payment = await piPaymentService.createA2UPayment({
        uid: wr.piUid,
        amount,
        memo: `MRI سحب مستحقات — ${wr.piUsername ?? wr.piUid.slice(0, 8)}`,
        metadata: { withdrawalId, doctorId: wr.doctorId },
      })
      piPaymentId = payment.paymentId
      toAddress = payment.toAddress ?? null
    }

    await prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.PROCESSING,
        piPaymentId,
        toAddress,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      },
    })

    return {
      ok: true,
      status: WithdrawalStatus.PROCESSING,
      piPaymentId: piPaymentId ?? undefined,
      toAddress: toAddress ?? undefined,
    }
  }

  // complete
  if (wr.status !== WithdrawalStatus.PROCESSING) {
    return { ok: false, message: 'يجب بدء التحويل أولاً (حالة: قيد المعالجة)' }
  }
  const txHash = opts?.txHash?.trim()
  if (!txHash) return { ok: false, message: 'معرف المعاملة على البلوكشين (txid) مطلوب' }
  if (!wr.piPaymentId) return { ok: false, message: 'معرف دفع Pi غير موجود — أعد «بدء التحويل»' }

  await piPaymentService.completePayment(wr.piPaymentId, txHash)

  await prisma.$transaction(async (db) => {
    await db.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.COMPLETED,
        txHash,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      },
    })
    if (wr.transactionId) {
      await db.transaction.update({
        where: { id: wr.transactionId },
        data: { status: TransactionStatus.COMPLETED, txHash },
      })
    }
  })

  await prisma.notification.create({
    data: {
      userId: wr.doctor.userId,
      title: '✅ تم تحويل المستحقات',
      body: `وصل ${Number(wr.amount).toFixed(4)} π إلى محفظة Pi (@${wr.piUsername ?? 'حسابك'})`,
      type: 'WITHDRAWAL_COMPLETED',
      data: { withdrawalId, txHash, amount: Number(wr.amount) },
    },
  })

  return { ok: true, status: WithdrawalStatus.COMPLETED }
}

export async function listDoctorWithdrawals(userId: string) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: { id: true, piBalance: true },
  })
  if (!doctor) return { balance: 0, requests: [] as ReturnType<typeof mapWithdrawalRow>[] }

  const rows = await prisma.withdrawalRequest.findMany({
    where: { doctorId: doctor.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  return {
    balance: Number(doctor.piBalance),
    minWithdrawal: MIN_DOCTOR_WITHDRAWAL_PI,
    requests: rows.map(mapWithdrawalRow),
  }
}

export async function listAdminWithdrawals() {
  const rows = await prisma.withdrawalRequest.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      doctor: {
        select: {
          firstName: true,
          lastName: true,
          piBalance: true,
          user: { select: { piUsername: true, email: true } },
        },
      },
    },
  })

  return rows.map((r) => ({
    ...mapWithdrawalRow(r),
    doctorBalance: Number(r.doctor.piBalance),
  }))
}
