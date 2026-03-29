'use client'
// src/app/(onboarding)/select-role/page.tsx
// يظهر للمستخدمين الجدد (Pi أو Email) قبل إكمال الـ Profile

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Role = 'CLIENT' | 'DOCTOR' | 'FACILITY'

const roles = [
  {
    value: 'CLIENT' as Role,
    label: 'عميل',
    subtitle: 'أبحث عن رعاية طبية',
    icon: '👤',
    color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    activeColor: 'from-blue-500/30 to-blue-600/20 border-blue-400/60',
  },
  {
    value: 'DOCTOR' as Role,
    label: 'طبيب',
    subtitle: 'أقدم خدمات طبية',
    icon: '🩺',
    color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    activeColor: 'from-emerald-500/30 to-emerald-600/20 border-emerald-400/60',
    note: 'يتطلب مراجعة الشهادات',
  },
  {
    value: 'FACILITY' as Role,
    label: 'منشأة',
    subtitle: 'مركز طبي أو مؤسسة',
    icon: '🏥',
    color: 'from-teal-500/20 to-teal-600/10 border-teal-500/30',
    activeColor: 'from-teal-500/30 to-teal-600/20 border-teal-400/60',
    note: 'يتطلب مراجعة الترخيص',
  },
]

export default function SelectRolePage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [selected, setSelected] = useState<Role>('CLIENT')
  const [isLoading, setIsLoading] = useState(false)

  async function handleContinue() {
    setIsLoading(true)
    try {
      // تحديث الدور في قاعدة البيانات
      const res = await fetch('/api/user/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selected }),
      })

      if (!res.ok) throw new Error('Failed to update role')

      // تحديث الـ session
      await update({ role: selected })

      // التوجيه لصفحة الـ Onboarding المناسبة
      const routes: Record<Role, string> = {
        CLIENT: '/onboarding/client',
        DOCTOR: '/onboarding/doctor',
        FACILITY: '/onboarding/facility',
      }
      router.push(routes[selected])
    } catch {
      console.error('Failed to update role')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">👋</div>
          <h1 className="text-2xl font-bold text-white">
            مرحباً{session?.user?.piUsername ? ` @${session.user.piUsername}` : ''}!
          </h1>
          <p className="text-slate-400 text-sm mt-2">كيف تريد استخدام المنصة؟</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-sm shadow-2xl space-y-4">
          {roles.map((role) => (
            <button
              key={role.value}
              type="button"
              onClick={() => setSelected(role.value)}
              className={`w-full p-4 rounded-xl border bg-gradient-to-br transition-all text-right ${
                selected === role.value ? role.activeColor : role.color
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">{role.icon}</span>
                <div className="flex-1">
                  <p className="font-bold text-white">{role.label}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{role.subtitle}</p>
                  {role.note && selected === role.value && (
                    <p className="text-amber-400 text-xs mt-1">⚠️ {role.note}</p>
                  )}
                </div>
                <div className={`w-5 h-5 rounded-full border-2 transition-all ${
                  selected === role.value ? 'border-white bg-white/20' : 'border-white/20'
                }`} />
              </div>
            </button>
          ))}

          <button
            type="button"
            onClick={handleContinue}
            disabled={isLoading}
            className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-sm shadow-lg shadow-emerald-500/20"
          >
            {isLoading ? 'جاري الحفظ...' : 'متابعة ←'}
          </button>
        </div>
      </div>
    </div>
  )
}
