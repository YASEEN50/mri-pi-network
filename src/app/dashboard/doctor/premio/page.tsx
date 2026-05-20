'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/common/Navbar'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface PremioSettings { monthlyPrice: number; yearlyPrice: number; lifetimePrice: number; isMonthlyEnabled: boolean; isYearlyEnabled: boolean; isLifetimeEnabled: boolean }
interface ActivePremio { type: string; status: string; expiryDate: string | null; startDate: string }

type Plan = { key: string; label: string; icon: string; price: number; desc: string }

export default function DoctorPremioPage() {
  const { status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<PremioSettings | null>(null)
  const [activePremio, setActivePremio] = useState<ActivePremio | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])
  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    try {
      const [s, p] = await Promise.all([fetch('/api/premio/settings'), fetch('/api/premio/my-premio')])
      const sd = await s.json(); const pd = await p.json()
      if (sd.success) setSettings(sd.data)
      if (pd.success) setActivePremio(pd.data)
    } finally { setIsLoading(false) }
  }

  async function handleSubscribe() {
    if (!selectedPlan) return
    setIsPaying(true)
    setMessage(null)
    try {
      const res = await fetch('/api/payment/premio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType: selectedPlan }),
      })
      const data = await res.json()
      if (data.success && !data.data?.error) {
        setMessage({ type: 'success', text: data.data?.message || '💎 تم تفعيل البريميو بنجاح!' })
        fetchData()
      } else {
        setMessage({ type: 'error', text: data.data?.message || 'حدث خطأ' })
      }
    } catch { setMessage({ type: 'error', text: 'حدث خطأ في الاتصال' }) }
    finally { setIsPaying(false) }
  }

  const premioTypeLabel = (type: string) => ({ MONTHLY: 'شهري', YEARLY: 'سنوي', LIFETIME: 'مدى الحياة', FREE_GIFT: 'هدية مجانية 🎁' }[type] ?? type)

  const plans: Plan[] = settings ? [
    ...(settings.isMonthlyEnabled ? [{ key: 'MONTHLY', label: 'شهري', icon: '📅', price: settings.monthlyPrice, desc: 'يجدد كل شهر' }] : []),
    ...(settings.isYearlyEnabled ? [{ key: 'YEARLY', label: 'سنوي', icon: '📆', price: settings.yearlyPrice, desc: 'يجدد كل سنة' }] : []),
    ...(settings.isLifetimeEnabled ? [{ key: 'LIFETIME', label: 'مدى الحياة', icon: '♾️', price: settings.lifetimePrice, desc: 'دفعة واحدة للأبد' }] : []),
  ] : []

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">البريميو 💎</h1>
          <p className="text-slate-400 text-sm mt-1">ارقَ بتجربتك على المنصة</p>
        </div>

        {message && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        {activePremio && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">💎</span>
              <div>
                <p className="text-emerald-400 font-semibold">اشتراك {premioTypeLabel(activePremio.type)} نشط</p>
                <p className="text-slate-400 text-sm mt-0.5">
                  {activePremio.expiryDate ? `ينتهي: ${new Date(activePremio.expiryDate).toLocaleDateString('ar-SA')}` : 'لا ينتهي أبداً ♾️'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-6">
          <h3 className="text-white font-semibold mb-4">✨ مزايا البريميو</h3>
          <div className="space-y-3">
            {[{ icon: '📚', text: 'نشر الدراسات والأبحاث العلمية' }, { icon: '📋', text: 'رفع أنظمة العمل والمنشورات الطبية' }, { icon: '🔝', text: 'أولوية الظهور في نتائج البحث' }, { icon: '✅', text: 'علامة مميزة بجانب اسمك' }, { icon: '📄', text: 'رفع الوثائق والشهادات المتقدمة' }].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span>{item.icon}</span>
                <span className="text-slate-300 text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {!activePremio && plans.length > 0 && (
          <>
            <h3 className="text-white font-semibold mb-4">اختر خطتك</h3>
            <div className="space-y-3 mb-6">
              {plans.map(plan => (
                <button key={plan.key} onClick={() => setSelectedPlan(plan.key)}
                  className={`w-full text-right px-5 py-4 rounded-2xl border transition-all ${selectedPlan === plan.key ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15]'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{plan.icon}</span>
                      <div>
                        <p className={`font-semibold ${selectedPlan === plan.key ? 'text-emerald-400' : 'text-white'}`}>{plan.label}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{plan.desc}</p>
                      </div>
                    </div>
                    <p className="text-white font-bold">{plan.price} Pi</p>
                  </div>
                </button>
              ))}
            </div>

            <button onClick={handleSubscribe} disabled={!selectedPlan || isPaying}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-all">
              {isPaying ? 'جاري الدفع...' : selectedPlan ? `الاشتراك في الخطة ${plans.find(p => p.key === selectedPlan)?.label}` : 'اختر خطة للمتابعة'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
