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
  MFA_REQUIRED: 'يلزم رمز المصادقة الثنائية — أدخل الرمز في الخطوة التالية',
  MFA_USE_EMAIL: 'حساب الإدارة يتطلب تسجيل الدخول بالبريد مع MFA',
  INVALID_MFA_TOKEN: 'انتهت جلسة MFA — أعد تسجيل الدخول',
  PASSWORD_NOT_SET:
    'لا توجد كلمة مرور لهذا الحساب. استخدم «نسيت كلمة المرور» — مع MFA سيطلب رمز Google Authenticator بدلاً من البريد.',
  DEFAULT: 'حدث خطأ، يرجى المحاولة مرة أخرى',
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramCallback = searchParams.get('callbackUrl')
  const [callbackUrl, setCallbackUrl] = useState('/')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [mfaStep, setMfaStep] = useState(false)
  const [challengeToken, setChallengeToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')

  useEffect(() => {
    if (searchParams.get('mfa') === 'required') {
      setError('يلزم إكمال التحقق الثنائي — أدخل البريد وكلمة المرور ثم رمز MFA')
    }
    if (paramCallback) {
      setCallbackUrl(paramCallback)
      return
    }
    if (isPiBrowser()) setCallbackUrl('/')
  }, [searchParams, paramCallback])

  async function completeSignIn() {
    router.push(callbackUrl)
    router.refresh()
    clearExplicitLogout()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const pre = await fetch('/api/auth/mfa/prelogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const preData = await pre.json()

      if (!preData.success) {
        setError(preData.error?.message ?? errorMessages.DEFAULT)
        return
      }

      if (preData.data?.error) {
        setError(errorMessages[preData.data.message] ?? errorMessages.INVALID_CREDENTIALS)
        return
      }

      if (preData.data?.mfaRequired) {
        setChallengeToken(preData.data.challengeToken)
        setMfaStep(true)
        return
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(errorMessages[result.error] ?? errorMessages.DEFAULT)
        return
      }

      await completeSignIn()
    } catch {
      setError(errorMessages.DEFAULT)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken, code: mfaCode }),
      })
      const data = await res.json()

      if (!data.success || data.data?.error) {
        setError(data.data?.message ?? 'رمز غير صحيح')
        return
      }

      const userId = data.data.userId as string
      const signInToken = data.data.signInToken as string

      const result = await signIn('mfa-token', {
        token: signInToken,
        userId,
        redirect: false,
      })

      if (result?.error) {
        setError(errorMessages[result.error] ?? errorMessages.DEFAULT)
        return
      }

      await completeSignIn()
    } catch {
      setError(errorMessages.DEFAULT)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      subtitle="منصة طبية موثوقة · تسجيل الدخول"
      cardTitle={mfaStep ? 'التحقق الثنائي' : 'مرحباً بك'}
      hint={mfaStep ? 'أدخل رمز تطبيق المصادقة أو رمز النسخ الاحتياطي' : 'أدخل بيانات حسابك أو سجّل الدخول بـ Pi'}
      error={error}
      footer={
        mfaStep ? undefined : (
          <AuthFooterLink href="/register">
            ليس لديك حساب؟ <strong style={{ color: 'var(--pi-accent)' }}>إنشاء حساب جديد</strong>
          </AuthFooterLink>
        )
      }
    >
      {mfaStep ? (
        <form onSubmit={handleMfaSubmit}>
          <label className="pi-auth-label" htmlFor="mfa-code">رمز MFA</label>
          <div className="pi-auth-input-wrap">
            <input
              id="mfa-code"
              className="pi-auth-input"
              type="text"
              inputMode="numeric"
              maxLength={16}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\s/g, ''))}
              placeholder="123456"
              required
              dir="ltr"
              autoComplete="one-time-code"
            />
          </div>
          <button
            type="submit"
            className="pi-auth-btn pi-auth-btn-email"
            disabled={isLoading || mfaCode.length < 6}
          >
            {isLoading ? (
              <>
                <span className="pi-auth-spinner" /> جاري التحقق...
              </>
            ) : (
              'تأكيد الدخول'
            )}
          </button>
          <button
            type="button"
            className="pi-auth-link mt-4 block w-full text-center"
            onClick={() => {
              setMfaStep(false)
              setMfaCode('')
              setChallengeToken('')
            }}
          >
            ← رجوع
          </button>
        </form>
      ) : (
      <>
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
          <Link href="/forgot-password?site=full" className="pi-auth-link">
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
      </>
      )}
    </AuthLayout>
  )
}
