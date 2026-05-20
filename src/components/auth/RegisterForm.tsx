'use client'
// src/components/auth/RegisterForm.tsx

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Role = 'CLIENT' | 'DOCTOR' | 'FACILITY'

interface RoleOption {
  value: Role
  label: string
  description: string
  icon: React.ReactNode
}

const roles: RoleOption[] = [
  {
    value: 'CLIENT',
    label: 'عميل',
    description: 'أبحث عن رعاية طبية وأريد حجز مواعيد',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    value: 'DOCTOR',
    label: 'طبيب',
    description: 'أنا طبيب وأريد تقديم خدماتي الطبية',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    value: 'FACILITY',
    label: 'منشأة',
    description: 'أمثل مركزاً طبياً أو مختبراً أو مؤسسة علمية',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
]

const passwordStrength = (password: string) => {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

export default function RegisterForm() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedRole, setSelectedRole] = useState<Role>('CLIENT')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const strength = passwordStrength(password)
  const strengthLabels = ['', 'ضعيفة', 'مقبولة', 'جيدة', 'قوية']
  const strengthColors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step === 1) { setStep(2); return }

    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }
    if (strength < 2) {
      setError('كلمة المرور ضعيفة جداً')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: selectedRole }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'EMAIL_ALREADY_EXISTS') {
          setError('هذا البريد الإلكتروني مسجل مسبقاً')
        } else if (data.error === 'VALIDATION_ERROR') {
          const firstError = Object.values(data.details ?? {})[0] as string[]
          setError(firstError?.[0] ?? 'خطأ في البيانات المدخلة')
        } else {
          setError('حدث خطأ، يرجى المحاولة مرة أخرى')
        }
        return
      }

      // تسجيل دخول تلقائي بعد التسجيل
      const signInResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (signInResult?.error) {
        setError('تم إنشاء الحساب، يرجى تسجيل الدخول')
        router.push('/login')
        return
      }

      // توجيه لصفحة اختيار الدور أو الـ onboarding
      router.push('/select-role')
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="fixed top-1/4 right-1/4 w-96 h-96 bg-teal-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 mb-4 shadow-lg shadow-emerald-500/25">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">إنشاء حساب جديد</h1>

          {/* Steps */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step >= s ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-500'
                }`}>
                  {step > s ? '✓' : s}
                </div>
                {s < 2 && <div className={`w-10 h-px ${step > s ? 'bg-emerald-500' : 'bg-white/10'}`} />}
              </div>
            ))}
          </div>
          <p className="text-slate-400 text-xs mt-2">
            {step === 1 ? 'اختر نوع الحساب' : 'بيانات الدخول'}
          </p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7 backdrop-blur-sm shadow-2xl">
          {error && (
            <div className="mb-5 flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 ? (
              <>
                {/* Role Selection */}
                <div className="space-y-3">
                  {roles.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setSelectedRole(role.value)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-right ${
                        selectedRole === role.value
                          ? 'border-emerald-500/60 bg-emerald-500/10'
                          : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                        selectedRole === role.value
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-white/5 text-slate-400'
                      }`}>
                        {role.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${selectedRole === role.value ? 'text-emerald-400' : 'text-white'}`}>
                          {role.label}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{role.description}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${
                        selectedRole === role.value
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-white/20'
                      }`}>
                        {selectedRole === role.value && (
                          <div className="w-full h-full rounded-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Doctor notice */}
                {(selectedRole === 'DOCTOR' || selectedRole === 'FACILITY') && (
                  <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                    <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-amber-400/80 text-xs leading-relaxed">
                      {selectedRole === 'DOCTOR'
                        ? 'ستحتاج إلى رفع الشهادات العلمية ورخصة مزاولة المهنة. سيتم مراجعة طلبك من قِبَل فريقنا.'
                        : 'ستحتاج إلى رفع وثيقة ترخيص المنشأة. سيتم مراجعة طلبك من قِبَل فريقنا.'}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold py-3 rounded-xl transition-all text-sm shadow-lg shadow-emerald-500/20"
                >
                  التالي ←
                </button>
              </>
            ) : (
              <>
                {/* Step 2 — Credentials */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    required
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/60 transition-all"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">كلمة المرور</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/60 transition-all pl-11"
                      dir="ltr"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                  {/* Strength Bar */}
                  {password && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? strengthColors[strength] : 'bg-white/10'}`} />
                        ))}
                      </div>
                      <p className={`text-xs ${['','text-red-400','text-orange-400','text-yellow-400','text-emerald-400'][strength]}`}>
                        قوة كلمة المرور: {strengthLabels[strength]}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">تأكيد كلمة المرور</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={`w-full bg-white/[0.05] border rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none transition-all ${
                      confirmPassword && confirmPassword !== password
                        ? 'border-red-500/50'
                        : 'border-white/[0.1] focus:border-emerald-500/60'
                    }`}
                    dir="ltr"
                  />
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-red-400 text-xs mt-1">كلمتا المرور غير متطابقتين</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError('') }}
                    className="flex-1 bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.08] text-white font-semibold py-3 rounded-xl transition-all text-sm"
                  >
                    → رجوع
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-sm shadow-lg shadow-emerald-500/20"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        جاري الإنشاء...
                      </span>
                    ) : 'إنشاء الحساب'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
            تسجيل الدخول
          </Link>
        </p>
      </div>
    </div>
  )
}
