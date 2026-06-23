'use client'
// src/app/(auth)/login/page.tsx

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PiLoginButton from '@/components/auth/PiLoginButton'
import { AuthLayout, AuthFooterLink } from '@/components/auth/AuthLayout'
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
    <AuthLayout
      subtitle="منصة طبية موثوقة · تسجيل الدخول"
      cardTitle="مرحباً بك"
      hint="أدخل بيانات حسابك أو سجّل الدخول بـ Pi"
      error={error}
      footer={
        <AuthFooterLink href="/register">
          ليس لديك حساب؟ <strong style={{ color: 'var(--pi-accent)' }}>إنشاء حساب جديد</strong>
        </AuthFooterLink>
      }
    >
      <form onSubmit={handleSubmit}>
        <label className="pi-auth-label" htmlFor="email">البريد الإلكتروني</label>
        <div className="pi-auth-input-wrap">
          <input
            id="email"
            className="pi-auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            required
            dir="ltr"
            autoComplete="email"
          />
        </div>

        <div className="pi-auth-row">
          <label className="pi-auth-label" htmlFor="password" style={{ margin: 0 }}>
            كلمة المرور
          </label>
          <Link href="/forgot-password" className="pi-auth-link">
            نسيت كلمة المرور؟
          </Link>
        </div>
        <div className="pi-auth-input-wrap">
          <input
            id="password"
            className="pi-auth-input has-toggle"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            dir="ltr"
            autoComplete="current-password"
          />
          <button
            type="button"
            className="pi-auth-input-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label="إظهار كلمة المرور"
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>

        <button
          type="submit"
          className="pi-auth-btn pi-auth-btn-email"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="pi-auth-spinner" /> جاري تسجيل الدخول...
            </>
          ) : (
            'تسجيل الدخول'
          )}
        </button>
      </form>

      <div className="pi-auth-divider">أو</div>

      <PiLoginButton callbackUrl={callbackUrl} />
    </AuthLayout>
  )
}
