'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DoctorSubpageLayout from '@/components/doctor/DoctorSubpageLayout'

interface TxRow {
  id: string
  type: string
  typeLabel: string
  status: string
  amountTotal: number
  receiverAmount: number
  platformFee: number
  txHash: string | null
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '⏳ معلق',
  COMPLETED: '✅ مكتمل',
  FAILED: '❌ فشل',
  REFUNDED: '↩️ مسترد',
}

export default function DoctorTransactionsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [balance, setBalance] = useState(0)
  const [items, setItems] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/doctor/transactions')
      const data = await res.json()
      if (data.data) {
        setBalance(data.data.balance ?? 0)
        setItems(data.data.items ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <DoctorSubpageLayout title="📒 سجل المعاملات" subtitle="كل الدفعات والسحوبات والمستحقات" maxWidth="4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25">
        <div>
          <p className="text-slate-400 text-xs">الرصيد الحالي</p>
          <p className="text-2xl font-bold text-purple-300" dir="ltr">
            {balance.toFixed(4)} π
          </p>
        </div>
        <Link
          href="/dashboard/doctor/withdrawals"
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
        >
          💸 سحب المستحقات
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-12">لا توجد معاملات بعد</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03] text-slate-400 text-xs">
                <th className="text-right p-3 font-medium">التاريخ</th>
                <th className="text-right p-3 font-medium">النوع</th>
                <th className="text-right p-3 font-medium">صافي</th>
                <th className="text-right p-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tx) => (
                <tr key={tx.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                  <td className="p-3 text-slate-400 text-xs whitespace-nowrap">
                    {new Date(tx.createdAt).toLocaleString('ar-SA')}
                  </td>
                  <td className="p-3 text-white">{tx.typeLabel}</td>
                  <td className="p-3 text-emerald-400 font-medium" dir="ltr">
                    {tx.receiverAmount.toFixed(4)} π
                    {tx.platformFee > 0 && (
                      <span className="block text-slate-500 text-[10px]">
                        عمولة {tx.platformFee.toFixed(4)}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs">{STATUS_LABELS[tx.status] ?? tx.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link
        href="/dashboard/doctor/schedule"
        className="inline-block mt-8 text-slate-400 text-sm hover:text-white"
      >
        ← العودة للمواعيد
      </Link>
    </DoctorSubpageLayout>
  )
}
