import { TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const TYPE_LABELS: Record<string, string> = {
  APPOINTMENT_FEE: 'رسوم موعد',
  DEPOSIT: 'إيداع موعد',
  FINAL_PAYMENT: 'دفعة نهائية',
  INSTANT_CONSULT: 'استشارة فورية',
  REFERRAL_REWARD: 'مكافأة إحالة',
  DOCTOR_WITHDRAWAL: 'سحب مستحقات',
  REFUND: 'استرداد',
}

function mapRow(r: {
  id: string
  type: TransactionType
  status: string
  amountTotal: { toString(): string } | number
  receiverAmount: { toString(): string } | number
  platformFee: { toString(): string } | number
  txHash: string | null
  createdAt: Date
}) {
  return {
    id: r.id,
    type: r.type,
    typeLabel: TYPE_LABELS[r.type] ?? r.type,
    status: r.status,
    amountTotal: Number(r.amountTotal),
    receiverAmount: Number(r.receiverAmount),
    platformFee: Number(r.platformFee),
    txHash: r.txHash,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function listDoctorTransactions(userId: string, limit = 50) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: { id: true, piBalance: true },
  })
  if (!doctor) {
    return { balance: 0, items: [] as ReturnType<typeof mapRow>[] }
  }

  const rows = await prisma.transaction.findMany({
    where: { doctorId: doctor.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      status: true,
      amountTotal: true,
      receiverAmount: true,
      platformFee: true,
      txHash: true,
      createdAt: true,
    },
  })

  return {
    balance: Number(doctor.piBalance),
    items: rows.map(mapRow),
  }
}
