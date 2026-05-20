'use client'
// src/app/select-role/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

const roles = [
  {
    id: 'CLIENT',
    label: 'عميل',
    subtitle: 'ابحث عن رعاية طبية',
    icon: '🧑‍⚕️',
    description: 'احجز مواعيد، تابع سجلك الطبي، وتواصل مع الأطباء.',
    color: 'from-emerald-500/20 to-teal-500/10',
    border: 'border-emerald-500/30',
    activeBorder: 'border-emerald-400',
    activeGlow: 'shadow-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  {
    id: 'DOCTOR',
    label: 'طبيب',
    subtitle: 'قدّم خدمات طبية',
    icon: '👨‍⚕️',
    description: 'أدر مواعيدك، تواصل مع مرضاك، وطوّر ممارستك المهنية.',
    color: 'from-blue-500/20 to-indigo-500/10',
    border: 'border-blue-500/30',
    activeBorder: 'border-blue-400',
    activeGlow: 'shadow-blue-500/20',
    dot: 'bg-blue-400',
  },
  {
    id: 'FACILITY',
    label: 'منشأة',
    subtitle: 'مركز طبي أو مؤسسة',
    icon: '🏥',
    description: 'أدر كادرك الطبي، استقبل المرضى، وطوّر خدمات منشأتك.',
    color: 'from-violet-500/20 to-purple-500/10',
    border: 'border-violet-500/30',
    activeBorder: 'border-violet-400',
    activeGlow: 'shadow-violet-500/20',
    dot: 'bg-violet-400',
  },
]

export default function SelectRolePage() {
  const router = useRouter()
  const { update } = useSession()
  const [selected, setSelected] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleContinue() {
    if (!selected) return
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/select-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selected }),
      })
      const data = await res.json()
      if (!res.ok || data.data?.error) {
        setError(data.data?.message || 'حدث خطأ')
        return
      }
      // تحديث الـ session
      await update({ role: selected, isProfileComplete: false })

      // توجيه لصفحة onboarding حسب الدور
      if (selected === 'CLIENT') router.push('/onboarding/client')
      else if (selected === 'DOCTOR') router.push('/onboarding/doctor')
      else if (selected === 'FACILITY') router.push('/onboarding/facility')
    } catch {
      setError('حدث خطأ في الاتصال')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4" dir="rtl">
      {/* Background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 mb-5 shadow-lg shadow-emerald-500/25">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">مرحباً! 👋</h1>
          <p className="text-slate-400">كيف تريد استخدام المنصة؟</p>
        </div>

        {/* Role Cards */}
        <div className="space-y-3 mb-6">
          {roles.map((role) => {
            const isActive = selected === role.id
            return (
              <button
                key={role.id}
                onClick={() => setSelected(role.id)}
                className={`
                  w-full text-right p-5 rounded-2xl border transition-all duration-200
                  bg-gradient-to-l ${role.color}
                  ${isActive
                    ? `${role.activeBorder} shadow-lg ${role.activeGlow} scale-[1.01]`
                    : `${role.border} hover:scale-[1.005] hover:brightness-110`
                  }
                `}
              >
                <div className="flex items-center gap-4">
                  {/* Radio */}
                  <div className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                    ${isActive ? `${role.activeBorder} border-2` : 'border-white/20'}
                  `}>
                    {isActive && <div className={`w-2.5 h-2.5 rounded-full ${role.dot}`} />}
                  </div>

                  {/* Icon */}
                  <div className="text-3xl">{role.icon}</div>

                  {/* Text */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white font-bold text-lg">{role.label}</span>
                      <span className="text-slate-400 text-sm">— {role.subtitle}</span>
                    </div>
                    <p className="text-slate-500 text-sm">{role.description}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!selected || isLoading}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              جاري المتابعة...
            </span>
          ) : 'متابعة ←'}
        </button>
      </div>
    </div>
  )
}