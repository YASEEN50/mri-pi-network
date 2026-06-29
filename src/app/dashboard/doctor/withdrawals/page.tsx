'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DoctorSubpageLayout from '@/components/doctor/DoctorSubpageLayout'

interface WithdrawalRow {
  id: string
  amount: number
  status: string
  piUsername: string | null
  txHash: string | null
  rejectionReason: string | null
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '⏳ بانتظار الإدارة',
  PROCESSING: '🔄 جاري التحويل',
  COMPLETED: '✅ مكتمل',
  REJECTED: '❌ مرفوض',
  FAILED: '⚠️ فشل',
}

export default function DoctorWithdrawalsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [balance, setBalance] = useState(0)
  const [minWithdrawal, setMinWithdrawal] = useState(1)
  const [requests, setRequests] = useState<WithdrawalRow[]>([])
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/doctor/withdrawals')
      const data = await res.json()
      if (data.data) {
        setBalance(data.data.balance ?? 0)
        setMinWithdrawal(data.data.minWithdrawal ?? 1)
        setRequests(data.data.requests ?? [])
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

  async function submitWithdrawal() {
    const value = parseFloat(amount)
    if (!value || value <= 0) {
      setMessage('⚠️ أدخل مبلغاً صحيحاً')
      return
    }
    setSubmitting(true)
    setMessage('')
    const res = await fetch('/api/doctor/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: value }),
    })
    const data = await res.json()
    if (!data.success || data.data?.error) {
      setMessage(`❌ ${data.data?.message ?? 'فشل الطلب'}`)
    } else {
      setMessage('✅ ' + (data.data.message ?? 'تم إرسال الطلب'))
      setAmount('')
      await load()
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const hasOpen = requests.some((r) => r.status === 'PENDING' || r.status === 'PROCESSING')

  return (
    <DoctorSubpageLayout title="💸 سحب المستحقات" subtitle="تحويل رصيدك إلى محفظة Pi">
      <div className="mb-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/25 text-sm text-purple-200">
        <p>
          رصيدك الداخلي يُجمَّع من المواعيد والاستشارات الفورية (بعد خصم 5% عمولة). عند الموافقة،
          تُرسل π إلى حساب Pi المربوط بملفك.
        </p>
        <p className="text-slate-400 text-xs mt-2">
          يجب تسجيل الدخول عبر Pi Browser وربط @piUsername من{' '}
          <Link href="/profile" className="text-purple-300 underline">
            الملف الشخصي
          </Link>
          .
        </p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-6">
        <p className="text-slate-400 text-xs mb-1">الرصيد المتاح للسحب</p>
        <p className="text-3xl font-bold text-emerald-400" dir="ltr">
          {balance.toFixed(4)} π
        </p>
      </div>

      {message && (
        <p
          className={`mb-4 text-sm ${message.startsWith('❌') || message.startsWith('⚠️') ? 'text-red-400' : 'text-emerald-400'}`}
        >
          {message}
        </p>
      )}

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-8 space-y-4">
        <h2 className="text-white font-semibold">طلب سحب جديد</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-slate-400 text-xs mb-1">المبلغ (π)</label>
            <input
              type="number"
              step="0.0001"
              min={minWithdrawal}
              max={balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={hasOpen || balance < minWithdrawal}
              placeholder={`الحد الأدنى ${minWithdrawal} π`}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
              dir="ltr"
            />
          </div>
          <button
            type="button"
            disabled={submitting || hasOpen || balance < minWithdrawal}
            onClick={() => void submitWithdrawal()}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium"
          >
            {submitting ? '...' : 'طلب سحب'}
          </button>
        </div>
        {hasOpen && (
          <p className="text-amber-400 text-xs">لديك طلب قيد المعالجة — انتظر اكتماله قبل طلب جديد.</p>
        )}
        <button
          type="button"
          onClick={() => setAmount(String(balance))}
          disabled={hasOpen || balance < minWithdrawal}
          className="text-xs text-slate-400 hover:text-white underline"
        >
          سحب كامل الرصيد
        </button>
      </div>

      <h2 className="text-white font-semibold mb-3">سجل الطلبات</h2>
      {requests.length === 0 ? (
        <p className="text-slate-500 text-sm py-6 text-center">لا توجد طلبات سحب</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div
              key={r.id}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]"
            >
              <div className="flex justify-between items-start gap-2">
                <span className="text-white font-medium" dir="ltr">
                  {r.amount.toFixed(4)} π
                </span>
                <span className="text-xs text-slate-400">{STATUS_LABELS[r.status] ?? r.status}</span>
              </div>
              <p className="text-slate-500 text-xs mt-1">
                {new Date(r.createdAt).toLocaleString('ar-SA')}
                {r.piUsername && ` — @${r.piUsername}`}
              </p>
              {r.txHash && (
                <p className="text-emerald-400/80 text-xs mt-1 truncate" dir="ltr">
                  tx: {r.txHash}
                </p>
              )}
              {r.rejectionReason && (
                <p className="text-red-400/80 text-xs mt-1">{r.rejectionReason}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Link
        href="/dashboard/doctor/analytics"
        className="inline-block mt-8 text-slate-400 text-sm hover:text-white"
      >
        ← العودة للتحليلات
      </Link>
    </DoctorSubpageLayout>
  )
}
