'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import OwnerSubpageLayout from '@/components/owner/OwnerSubpageLayout'

interface WithdrawalRow {
  id: string
  amount: number
  status: string
  piUsername: string | null
  piPaymentId: string | null
  toAddress: string | null
  txHash: string | null
  rejectionReason: string | null
  createdAt: string
  doctorName?: string
  doctorContact?: string
  doctorBalance?: number
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '⏳ جديد',
  PROCESSING: '🔄 قيد التحويل',
  COMPLETED: '✅ مكتمل',
  REJECTED: '❌ مرفوض',
  FAILED: '⚠️ فشل',
}

export default function OwnerWithdrawalsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [rows, setRows] = useState<WithdrawalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [txInputs, setTxInputs] = useState<Record<string, string>>({})
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/withdrawals')
      const data = await res.json()
      setRows(data.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role !== 'OWNER' && session?.user?.role !== 'ADMIN') {
      router.push('/unauthorized')
    }
  }, [status, session, router])

  useEffect(() => {
    if (status === 'authenticated') void load()
  }, [status, load])

  async function act(id: string, action: 'start' | 'complete' | 'reject', extra?: { txHash?: string; rejectionReason?: string }) {
    setBusy(id)
    setMsg('')
    const res = await fetch('/api/admin/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, ...extra }),
    })
    const data = await res.json()
    if (!data.success || data.data?.error) {
      setMsg(`❌ ${data.data?.message ?? 'فشل'}`)
    } else if (action === 'start') {
      setMsg(
        `✅ بدء التحويل — Pi payment: ${data.data.piPaymentId ?? '—'}${data.data.toAddress ? ` → ${data.data.toAddress}` : ''}. أرسل π من محفظة التطبيق ثم أدخل txid.`,
      )
    } else {
      setMsg('✅ تم')
      setRejectId(null)
    }
    await load()
    setBusy(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const pending = rows.filter((r) => r.status === 'PENDING' || r.status === 'PROCESSING')

  return (
    <OwnerSubpageLayout title="💸 سحب مستحقات الأطباء" subtitle="تحويل π من محفظة التطبيق إلى محفظة الطبيب (A2U)">
      <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-100">
        <p className="font-medium mb-1">خطوات التحويل:</p>
        <ol className="list-decimal list-inside text-xs space-y-1 text-amber-200/90">
          <li>«بدء التحويل» — ينشئ دفعة A2U على Pi Network</li>
          <li>أرسل π من محفظة تطبيق المنصة إلى العنوان المعروض (مع memo الدفع)</li>
          <li>الصق txid من البلوكشين واضغط «تأكيد التحويل»</li>
        </ol>
      </div>

      {msg && <p className={`mb-4 text-sm ${msg.startsWith('❌') ? 'text-red-400' : 'text-emerald-400'}`}>{msg}</p>}

      <p className="text-slate-400 text-sm mb-4">{pending.length} طلب بانتظار الإجراء</p>

      {rows.length === 0 ? (
        <p className="text-slate-500 text-center py-12">لا توجد طلبات</p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <div>
                  <p className="text-white font-medium">{r.doctorName ?? 'طبيب'}</p>
                  <p className="text-slate-500 text-xs">
                    {r.doctorContact && `🟣 ${r.doctorContact} · `}
                    رصيد حالي: {(r.doctorBalance ?? 0).toFixed(4)} π
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-emerald-400 font-bold" dir="ltr">
                    {r.amount.toFixed(4)} π
                  </p>
                  <p className="text-xs text-slate-500">{STATUS_LABELS[r.status] ?? r.status}</p>
                </div>
              </div>
              <p className="text-slate-500 text-xs">{new Date(r.createdAt).toLocaleString('ar-SA')}</p>
              {r.piPaymentId && (
                <p className="text-purple-300 text-xs mt-1 truncate" dir="ltr">
                  payment: {r.piPaymentId}
                </p>
              )}
              {r.toAddress && (
                <p className="text-blue-300 text-xs mt-1 truncate" dir="ltr">
                  to: {r.toAddress}
                </p>
              )}

              {r.status === 'PENDING' && (
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => void act(r.id, 'start')}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
                  >
                    بدء التحويل
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectId(r.id)}
                    className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm"
                  >
                    رفض
                  </button>
                </div>
              )}

              {r.status === 'PROCESSING' && (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    placeholder="txid من Pi Blockchain"
                    value={txInputs[r.id] ?? ''}
                    onChange={(e) => setTxInputs((p) => ({ ...p, [r.id]: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                    dir="ltr"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() =>
                        void act(r.id, 'complete', { txHash: txInputs[r.id] })
                      }
                      className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm"
                    >
                      تأكيد التحويل
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectId(r.id)}
                      className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm"
                    >
                      رفض
                    </button>
                  </div>
                </div>
              )}

              {rejectId === r.id && (
                <div className="mt-3 space-y-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="سبب الرفض"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm min-h-[60px]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() =>
                        void act(r.id, 'reject', { rejectionReason: rejectReason })
                      }
                      className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm"
                    >
                      تأكيد الرفض
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectId(null)
                        setRejectReason('')
                      }}
                      className="px-4 py-2 rounded-xl border border-white/10 text-slate-400 text-sm"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </OwnerSubpageLayout>
  )
}
