'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import DoctorSubpageLayout from '@/components/doctor/DoctorSubpageLayout'
import PremioBadge from '@/components/premio/PremioBadge'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { payForPremioPlan, piPaymentErrorMessage } from '@/lib/pi/pi-payment-client'
import type { PremioTier } from '@/lib/premio/tiers'

interface PremioSettings { monthlyPrice: number; yearlyPrice: number; lifetimePrice: number; isMonthlyEnabled: boolean; isYearlyEnabled: boolean; isLifetimeEnabled: boolean }
interface ActivePremio { type: string; status: string; expiryDate: string | null; startDate: string; tier?: PremioTier }

type Plan = { key: string; label: string; icon: string; price: number; desc: string; tier: PremioTier }

const BENEFIT_KEYS = [
  'benefit_listing',
  'benefit_badge',
  'benefit_featured',
  'benefit_analytics_basic',
  'benefit_analytics_full',
  'benefit_analytics_referrals',
] as const

const BENEFIT_TIERS: Record<(typeof BENEFIT_KEYS)[number], PremioTier[]> = {
  benefit_listing: ['BASIC', 'PRO', 'ELITE'],
  benefit_badge: ['PRO', 'ELITE'],
  benefit_featured: ['PRO', 'ELITE'],
  benefit_analytics_basic: ['BASIC', 'PRO', 'ELITE'],
  benefit_analytics_full: ['PRO', 'ELITE'],
  benefit_analytics_referrals: ['ELITE'],
}

export default function DoctorPremioPage() {
  const { status } = useSession()
  const router = useRouter()
  const tp = useTranslations('premio')
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
    if (!selectedPlan || !settings) return

    let price = 0
    let label = ''
    if (selectedPlan === 'MONTHLY') { price = settings.monthlyPrice; label = 'شهري' }
    else if (selectedPlan === 'YEARLY') { price = settings.yearlyPrice; label = 'سنوي' }
    else if (selectedPlan === 'LIFETIME') { price = settings.lifetimePrice; label = 'مدى الحياة' }
    else return

    setIsPaying(true)
    setMessage(null)
    try {
      await payForPremioPlan(
        selectedPlan as 'MONTHLY' | 'YEARLY' | 'LIFETIME',
        price,
        label,
      )
      setMessage({ type: 'success', text: '💎 تم الدفع وتفعيل البريميو بنجاح!' })
      fetchData()
    } catch (err) {
      setMessage({ type: 'error', text: piPaymentErrorMessage(err) })
    } finally { setIsPaying(false) }
  }

  const premioTypeLabel = (type: string) => ({ MONTHLY: 'شهري', YEARLY: 'سنوي', LIFETIME: 'مدى الحياة', FREE_GIFT: 'هدية مجانية 🎁' }[type] ?? type)

  const plans: Plan[] = settings ? [
    ...(settings.isMonthlyEnabled ? [{ key: 'MONTHLY', label: 'شهري', icon: '📅', price: settings.monthlyPrice, desc: tp('tier_basic'), tier: 'BASIC' as const }] : []),
    ...(settings.isYearlyEnabled ? [{ key: 'YEARLY', label: 'سنوي', icon: '📆', price: settings.yearlyPrice, desc: tp('tier_pro'), tier: 'PRO' as const }] : []),
    ...(settings.isLifetimeEnabled ? [{ key: 'LIFETIME', label: 'مدى الحياة', icon: '♾️', price: settings.lifetimePrice, desc: tp('tier_elite'), tier: 'ELITE' as const }] : []),
  ] : []

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <DoctorSubpageLayout title="البريميو 💎" subtitle="الدفع حصرياً بعملة Pi">
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        <div className="mb-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/25">
          <p className="text-purple-300 text-sm">
            🟣 جميع المدفوعات على المنصة — بما فيها البريميو — تتم <strong>فقط</strong> بعملة <strong>Pi</strong> داخل Pi Browser.
          </p>
        </div>

        {activePremio && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-3xl">💎</span>
              <div>
                <p className="text-emerald-400 font-semibold flex items-center gap-2 flex-wrap">
                  اشتراك {premioTypeLabel(activePremio.type)} نشط
                  {activePremio.tier && <PremioBadge tier={activePremio.tier} size="md" />}
                </p>
                <p className="text-slate-400 text-sm mt-0.5">
                  {activePremio.expiryDate ? `ينتهي: ${new Date(activePremio.expiryDate).toLocaleDateString('ar-SA')}` : 'لا ينتهي أبداً ♾️'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-6 overflow-x-auto">
          <h3 className="text-white font-semibold mb-4">{tp('tiers_title')}</h3>
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-slate-400 border-b border-white/10">
                <th className="text-start py-2 pe-4" />
                <th className="py-2 px-2 text-center">{tp('tier_basic')}</th>
                <th className="py-2 px-2 text-center">{tp('tier_pro')}</th>
                <th className="py-2 px-2 text-center">{tp('tier_elite')}</th>
              </tr>
            </thead>
            <tbody>
              {BENEFIT_KEYS.map(key => (
                <tr key={key} className="border-b border-white/5">
                  <td className="py-2.5 pe-4 text-slate-300">{tp(key)}</td>
                  {(['BASIC', 'PRO', 'ELITE'] as PremioTier[]).map(tier => (
                    <td key={tier} className="py-2.5 text-center">
                      {BENEFIT_TIERS[key].includes(tier) ? '✅' : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
                        <p className={`font-semibold flex items-center gap-2 ${selectedPlan === plan.key ? 'text-emerald-400' : 'text-white'}`}>
                          {plan.label}
                          <PremioBadge tier={plan.tier} />
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">{plan.desc}</p>
                      </div>
                    </div>
                    <p className="text-white font-bold">{plan.price} π</p>
                  </div>
                </button>
              ))}
            </div>

            <button onClick={handleSubscribe} disabled={!selectedPlan || isPaying}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-all">
              {isPaying ? 'جاري الدفع عبر Pi...' : selectedPlan ? `ادفع ${plans.find(p => p.key === selectedPlan)?.price} π — ${plans.find(p => p.key === selectedPlan)?.label}` : 'اختر خطة للمتابعة'}
            </button>
          </>
        )}

        {!activePremio && plans.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-8">لم يفعّل المالك خطط البريميو بعد.</p>
        )}
    </DoctorSubpageLayout>
  )
}
