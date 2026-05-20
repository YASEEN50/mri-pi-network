'use client'
import Navbar from '@/components/common/Navbar'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface PremioSettings {
  monthlyPrice: string
  yearlyPrice: string
  lifetimePrice: string
  isMonthlyEnabled: boolean
  isYearlyEnabled: boolean
  isLifetimeEnabled: boolean
}

export default function PremioSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<PremioSettings>({
    monthlyPrice: '', yearlyPrice: '', lifetimePrice: '',
    isMonthlyEnabled: true, isYearlyEnabled: true, isLifetimeEnabled: true,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role !== 'OWNER') router.push('/unauthorized')
  }, [status, session, router])

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/owner/premio-settings')
      const data = await res.json()
      if (data.success && data.data) {
        setSettings({
          monthlyPrice: data.data.monthlyPrice?.toString() ?? '',
          yearlyPrice: data.data.yearlyPrice?.toString() ?? '',
          lifetimePrice: data.data.lifetimePrice?.toString() ?? '',
          isMonthlyEnabled: data.data.isMonthlyEnabled ?? true,
          isYearlyEnabled: data.data.isYearlyEnabled ?? true,
          isLifetimeEnabled: data.data.isLifetimeEnabled ?? true,
        })
      }
    } catch {} finally { setIsLoading(false) }
  }

  async function handleSave() {
    setIsSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/owner/premio-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyPrice: parseFloat(settings.monthlyPrice) || 0,
          yearlyPrice: parseFloat(settings.yearlyPrice) || 0,
          lifetimePrice: parseFloat(settings.lifetimePrice) || 0,
          isMonthlyEnabled: settings.isMonthlyEnabled,
          isYearlyEnabled: settings.isYearlyEnabled,
          isLifetimeEnabled: settings.isLifetimeEnabled,
        }),
      })
      const data = await res.json()
      if (data.success) setMessage({ type: 'success', text: 'تم حفظ الإعدادات بنجاح ✅' })
      else setMessage({ type: 'error', text: data.error?.message || 'حدث خطأ' })
    } catch { setMessage({ type: 'error', text: 'حدث خطأ في الاتصال' }) }
    finally { setIsSaving(false) }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  const plans = [
    { key: 'monthly' as const, label: 'الاشتراك الشهري', desc: 'يجدد كل شهر', enabled: 'isMonthlyEnabled' as const, price: 'monthlyPrice' as const },
    { key: 'yearly' as const, label: 'الاشتراك السنوي', desc: 'يجدد كل سنة', enabled: 'isYearlyEnabled' as const, price: 'yearlyPrice' as const },
    { key: 'lifetime' as const, label: 'اشتراك مدى الحياة', desc: 'دفعة واحدة للأبد', enabled: 'isLifetimeEnabled' as const, price: 'lifetimePrice' as const },
  ]

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">إعدادات البريميو 💎</h1>
          <p className="text-slate-400 text-sm mt-1">تحكم بأسعار اشتراكات البريميو</p>
        </div>

        {message && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          {plans.map(plan => (
            <div key={plan.key} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold">{plan.label}</h3>
                  <p className="text-slate-400 text-xs mt-0.5">{plan.desc}</p>
                </div>
                <button onClick={() => setSettings(s => ({ ...s, [plan.enabled]: !s[plan.enabled] }))}
                  className={`w-12 h-6 rounded-full transition-colors ${settings[plan.enabled] ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform ${settings[plan.enabled] ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <input type="number" value={settings[plan.price]}
                  onChange={e => setSettings(s => ({ ...s, [plan.price]: e.target.value }))}
                  placeholder="0.00" min="0" step="0.01"
                  disabled={!settings[plan.enabled]}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 disabled:opacity-40" />
                <span className="text-slate-400 text-sm">Pi</span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={handleSave} disabled={isSaving}
          className="w-full mt-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl font-medium transition-all">
          {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </div>
    </div>
  )
}
