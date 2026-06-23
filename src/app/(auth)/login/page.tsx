'use client'
// src/app/(auth)/login/page.tsx

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PiLoginButton from '@/components/auth/PiLoginButton'
import { Input, Button, Alert } from '@/components/ui'
import { clearExplicitLogout, isPiBrowser } from '@/lib/pi/pi-auth-client'

const errorMessages: Record<string, string> = {
  INVALID_CREDENTIALS: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  ACCOUNT_DISABLED: 'تم تعليق هذا الحساب، تواصل مع الدعم',
  MISSING_CREDENTIALS: 'يرجى إدخال البريد الإلكتروني وكلمة المرور',
  DEFAULT: 'حدث خطأ، يرجى المحاولة مرة أخرى',
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramCallback = searchParams.get('callbackUrl')
  const [callbackUrl, setCallbackUrl] = useState('/dashboard')

  useEffect(() => {
    if (paramCallback) {
      setCallbackUrl(paramCallback)
      return
    }
    if (isPiBrowser()) setCallbackUrl('/dashboard')
  }, [paramCallback])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setIsLoading(false)

    if (result?.error) {
      setError(errorMessages[result.error] ?? errorMessages.DEFAULT)
      return
    }

    router.push(callbackUrl)
    router.refresh()
    clearExplicitLogout()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 mpi-grid-bg" dir="rtl">
      <div className="fixed inset-0 mpi-hero-glow pointer-events-none" />
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4 shadow-glow-primary">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide">MRI</h1>
          <p className="text-slate-400 text-sm mt-1">منصة طبية موثوقة · تسجيل الدخول</p>
        </div>

        <div className="mpi-card p-8 shadow-card">
          {error && <Alert variant="error" className="mb-5">{error}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="البريد الإلكتروني"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              dir="ltr"
            />

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-300">كلمة المرور</label>
                <Link href="/forgot-password" className="text-xs text-accent hover:text-white transition-colors">
                  نسيت كلمة المرور؟
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-surface/80 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all pl-11"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full" loading={isLoading}>
              {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-slate-500">أو</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="rounded-xl border border-accent/25 bg-accent/5 p-1">
            <PiLoginButton callbackUrl={callbackUrl} />
          </div>
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          ليس لديك حساب؟{' '}
          <Link href="/register" className="text-accent hover:text-white font-medium transition-colors">
            إنشاء حساب جديد
          </Link>
        </p>
      </div>
    </div>
  )
}
