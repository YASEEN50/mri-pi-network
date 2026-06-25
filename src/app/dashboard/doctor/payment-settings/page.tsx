'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import DoctorSubpageLayout from '@/components/doctor/DoctorSubpageLayout'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const policies = [
  { key: 'PAY_BEFORE_BOOKING', label: 'دفع كامل قبل الحجز', icon: '💳', description: 'يدفع المريض المبلغ كاملاً بـ Pi عند الحجز' },
  { key: 'DEPOSIT_AND_PAY_LATER', label: 'إيداع مسبق + دفع لاحق', icon: '💰', description: 'إيداع Pi عند الحجز والباقي بعد الخدمة' },
  { key: 'PAY_ON_SERVICE', label: 'دفع بعد الخدمة', icon: '🤝', description: 'يدفع المريض بـ Pi بعد انتهاء الموعد (افتراضي)' },
]

export default function DoctorPaymentSettingsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [consultationFee, setConsultationFee] = useState('')
  const [selectedPolicy, setSelectedPolicy] = useState('PAY_ON_SERVICE')
  const [depositPercentage, setDepositPercentage] = useState('30')
  const [deadlineHours, setDeadlineHours] = useState('24')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])
  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/doctor/payment-settings')
      const data = await res.json()
      if (data.success && data.data) {
        setSelectedPolicy(data.data.paymentPolicy)
        setDepositPercentage(data.data.depositPercentage?.toString() ?? '30')
        setDeadlineHours(data.data.paymentDeadlineHours?.toString() ?? '24')
        setConsultationFee(data.data.consultationFee?.toString() ?? '')
      }
    } catch {} finally { setIsLoading(false) }
  }

  async function handleSave() {
    setIsSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/doctor/payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentPolicy: selectedPolicy,
          depositPercentage: parseFloat(depositPercentage) || 0,
          paymentDeadlineHours: parseInt(deadlineHours) || 24,
          consultationFee: consultationFee ? parseFloat(consultationFee) : undefined,
        }),
      })
      const data = await res.json()
      if (data.success && !data.data?.error) setMessage({ type: 'success', text: 'تم حفظ إعدادات الدفع بنجاح ✅' })
      else setMessage({ type: 'error', text: data.data?.message || data.error?.message || 'حدث خطأ' })
    } catch { setMessage({ type: 'error', text: 'حدث خطأ في الاتصال' }) }
    finally { setIsSaving(false) }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <DoctorSubpageLayout title="إعدادات الدفع 💳" subtitle="سياسة الدفع — عملة Pi فقط">
        <div className="mb-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/25">
          <p className="text-purple-300 text-sm">
            🟣 المنصة تقبل <strong>عملة Pi الرقمية فقط</strong>. رسوم الاستشارة تُعرض بالـ Pi ويُدفع عبر Pi Browser.
          </p>
          <p className="text-slate-400 text-xs mt-2">
            يُخصم <strong className="text-warning">5%</strong> عمولة المنصة تلقائياً من كل مبلغ يتقاضاه الطبيب — يُضاف الباقي (95%) لرصيدك فوراً.
          </p>
        </div>
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-6">
          <h3 className="text-white font-semibold mb-2">رسوم الاستشارة (π Pi)</h3>
          <p className="text-slate-500 text-xs mb-3">المبلغ الذي يراه المريض عند الحجز — بالعملة الرقمية Pi فقط</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={consultationFee}
              onChange={e => setConsultationFee(e.target.value)}
              min="0.0001"
              step="0.0001"
              placeholder="مثال: 10"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              dir="ltr"
            />
            <span className="text-purple-300 text-sm font-medium">π</span>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {policies.map(policy => (
            <button key={policy.key} onClick={() => setSelectedPolicy(policy.key)}
              className={`w-full text-right px-5 py-4 rounded-2xl border transition-all ${selectedPolicy === policy.key ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15]'}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{policy.icon}</span>
                <div className="flex-1">
                  <p className={`font-semibold ${selectedPolicy === policy.key ? 'text-emerald-400' : 'text-white'}`}>{policy.label}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{policy.description}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPolicy === policy.key ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'}`}>
                  {selectedPolicy === policy.key && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
              </div>
            </button>
          ))}
        </div>

        {selectedPolicy === 'DEPOSIT_AND_PAY_LATER' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
            <h3 className="text-white font-semibold mb-4">نسبة الإيداع المسبق</h3>
            <div className="flex items-center gap-3">
              <input type="number" value={depositPercentage} onChange={e => setDepositPercentage(e.target.value)} min="1" max="99"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
              <span className="text-slate-400 text-sm">%</span>
            </div>
            {consultationFee && (
              <div className="flex justify-between text-sm mt-3 pt-3 border-t border-white/10">
                <span className="text-slate-400">المبلغ عند الحجز ({depositPercentage}%)</span>
                <span className="text-amber-400">
                  {(parseFloat(consultationFee || '0') * (parseFloat(depositPercentage) / 100)).toFixed(4)} π
                </span>
              </div>
            )}
          </div>
        )}

        {selectedPolicy !== 'PAY_ON_SERVICE' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-6">
            <h3 className="text-white font-semibold mb-4">مهلة الدفع قبل الموعد</h3>
            <div className="flex items-center gap-3">
              <input type="number" value={deadlineHours} onChange={e => setDeadlineHours(e.target.value)} min="1" max="168"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
              <span className="text-slate-400 text-sm">ساعة</span>
            </div>
          </div>
        )}

        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 mb-6">
          <p className="text-blue-400 text-sm">ℹ️ لا يمكن تغيير سياسة الدفع إذا كان لديك مواعيد قيد الانتظار</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={handleSave} disabled={isSaving}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all">
            {isSaving ? 'جاري الحفظ...' : 'حفظ إعدادات الدفع'}
          </button>
          <Link href="/dashboard/doctor/schedule"
            className="flex-1 py-3 rounded-xl text-center font-medium text-sm border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-all">
            ← العودة إلى جدول المواعيد
          </Link>
        </div>

        {message?.type === 'success' && (
          <Link href="/dashboard/doctor/schedule"
            className="mt-4 block w-full py-3 rounded-xl text-center bg-primary hover:bg-primary-400 text-white font-semibold text-sm transition-all shadow-glow-primary">
            متابعة إلى جدول المواعيد →
          </Link>
        )}
    </DoctorSubpageLayout>
  )
}
