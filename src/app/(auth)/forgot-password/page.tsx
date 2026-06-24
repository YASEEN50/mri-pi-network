'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthLayout, AuthFooterLink } from '@/components/auth/AuthLayout'

const RESEND_SECONDS = 120

type Step = 'email' | 'otp' | 'mfa' | 'password' | 'done'
type ResetMethod = 'email' | 'mfa'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [resetMethod, setResetMethod] = useState<ResetMethod | null>(null)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [mfaCode, setMfaCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [showPass, setShowPass] = useState(false)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (countdown <= 0) return
    timerRef.current = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [countdown])

  const stepIndex =
    step === 'email' ? 0 : step === 'otp' || step === 'mfa' ? 1 : step === 'password' ? 2 : 3

  const progressLabels =
    resetMethod === 'mfa'
      ? ['البريد', 'MFA', 'كلمة المرور']
      : ['البريد', 'الرمز', 'كلمة المرور']

  const hints: Record<Step, string> = {
    email: 'أدخل بريدك الإلكتروني',
    otp: 'أدخل الرمز المرسل إلى بريدك',
    mfa: 'أدخل رمز MFA من Google Authenticator أو رمز النسخ الاحتياطي',
    password: 'اختر كلمة مرور جديدة آمنة',
    done: 'تم تغيير كلمة المرور بنجاح',
  }

  async function startReset() {
    if (!email) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error?.message ?? 'حدث خطأ')
        return
      }
      if (data.data?.error) {
        setError(data.data.message)
        return
      }
      if (data.data?.method === 'mfa') {
        setResetMethod('mfa')
        setStep('mfa')
        return
      }
      setResetMethod('email')
      setStep('otp')
      setCountdown(RESEND_SECONDS)
    } catch {
      setError('خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  async function resendOtp() {
    if (countdown > 0) return
    setLoading(true)
    setError('')
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setOtp(['', '', '', '', '', ''])
      setCountdown(RESEND_SECONDS)
      setError('')
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    if (value && index < 5) inputsRef.current[index + 1]?.focus()
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setOtp(text.split(''))
      inputsRef.current[5]?.focus()
    }
    e.preventDefault()
  }

  function continueToPassword() {
    if (resetMethod === 'mfa') {
      if (mfaCode.replace(/\s/g, '').length < 6) {
        setError('أدخل رمز MFA (6 أرقام على الأقل)')
        return
      }
    } else if (otp.join('').length < 6) {
      setError('أدخل الرمز كاملاً')
      return
    }
    setError('')
    setStep('password')
  }

  async function resetPassword() {
    if (password.length < 8) {
      setError('كلمة المرور 8 أحرف على الأقل')
      return
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }
    setLoading(true)
    setError('')
    try {
      const payload =
        resetMethod === 'mfa'
          ? { email, mfaCode: mfaCode.replace(/\s/g, ''), password }
          : { email, otp: otp.join(''), password }

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success || data.data?.error) {
        setError(data.data?.message ?? data.error?.message ?? 'فشل إعادة التعيين')
        return
      }
      setStep('done')
      setTimeout(() => router.push('/login?site=full'), 3000)
    } catch {
      setError('خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <AuthLayout
      subtitle="استعادة كلمة المرور"
      cardTitle="إعادة تعيين كلمة المرور"
      hint={hints[step]}
      error={step !== 'done' ? error : undefined}
      showTrust={step !== 'done'}
      footer={
        step === 'email' ? (
          <AuthFooterLink href="/login?site=full">← العودة لتسجيل الدخول</AuthFooterLink>
        ) : undefined
      }
    >
      {step !== 'done' && (
        <div className="pi-auth-progress">
          {progressLabels.map((label, i) => (
            <div key={label} className="pi-auth-progress-item">
              <div
                className={`pi-auth-progress-bar ${
                  i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''
                }`}
              />
              <span className={`pi-auth-progress-label ${i <= stepIndex ? 'active' : ''}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      {step === 'email' && (
        <>
          <p className="pi-auth-hint" style={{ marginTop: 0 }}>
            حسابات المالك/الأدمن مع MFA تستخدم رمز المصادقة الثنائية بدلاً من البريد.
          </p>
          <label className="pi-auth-label" htmlFor="fp-email">البريد الإلكتروني</label>
          <div className="pi-auth-input-wrap">
            <input
              id="fp-email"
              className="pi-auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startReset()}
              placeholder="example@email.com"
              dir="ltr"
              autoComplete="email"
            />
          </div>
          <button
            type="button"
            className="pi-auth-btn pi-auth-btn-email"
            onClick={startReset}
            disabled={loading || !email}
          >
            {loading ? (
              <>
                <span className="pi-auth-spinner" /> جاري المتابعة...
              </>
            ) : (
              'متابعة'
            )}
          </button>
        </>
      )}

      {step === 'mfa' && (
        <>
          <p className="pi-auth-hint" style={{ marginTop: 0 }}>
            حساب <strong style={{ color: 'var(--pi-accent)' }} dir="ltr">{email}</strong> محمي
            بـ MFA — لا حاجة لبريد إلكتروني.
          </p>
          <label className="pi-auth-label" htmlFor="fp-mfa">رمز MFA</label>
          <div className="pi-auth-input-wrap">
            <input
              id="fp-mfa"
              className="pi-auth-input"
              type="text"
              inputMode="numeric"
              maxLength={16}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\s/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && continueToPassword()}
              placeholder="123456"
              dir="ltr"
              autoComplete="one-time-code"
            />
          </div>
          <button
            type="button"
            className="pi-auth-btn pi-auth-btn-email"
            onClick={continueToPassword}
            disabled={loading || mfaCode.length < 6}
          >
            متابعة
          </button>
          <button
            type="button"
            className="pi-auth-btn pi-auth-btn-outline"
            style={{ marginTop: 10 }}
            onClick={() => {
              setStep('email')
              setResetMethod(null)
              setMfaCode('')
            }}
          >
            ← تغيير البريد الإلكتروني
          </button>
        </>
      )}

      {step === 'otp' && (
        <>
          <p className="pi-auth-hint" style={{ marginTop: 0 }}>
            الرمز أُرسل إلى{' '}
            <strong style={{ color: 'var(--pi-accent)' }} dir="ltr">
              {email}
            </strong>
          </p>

          <div className="pi-auth-otp-row">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el
                }}
                className={`pi-auth-otp-input ${digit ? 'filled' : ''}`}
                type="text"
                inputMode="numeric"
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                onPaste={i === 0 ? handleOtpPaste : undefined}
                maxLength={1}
              />
            ))}
          </div>

          <p className="pi-auth-hint">
            الرمز صالح لمدة <strong style={{ color: '#fbbf24' }}>15 دقيقة</strong>
          </p>

          <div className="pi-auth-text-center" style={{ marginBottom: 14 }}>
            {countdown > 0 ? (
              <span className="pi-auth-hint" style={{ margin: 0 }}>
                إعادة الإرسال بعد{' '}
                <strong style={{ color: '#fbbf24' }}>{formatTime(countdown)}</strong>
              </span>
            ) : (
              <button
                type="button"
                className="pi-auth-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
                onClick={resendOtp}
                disabled={loading}
              >
                ↻ إعادة إرسال الرمز
              </button>
            )}
          </div>

          <button
            type="button"
            className="pi-auth-btn pi-auth-btn-email"
            onClick={continueToPassword}
            disabled={loading || otp.join('').length < 6}
          >
            تحقق من الرمز
          </button>

          <button
            type="button"
            className="pi-auth-btn pi-auth-btn-outline"
            style={{ marginTop: 10 }}
            onClick={() => setStep('email')}
          >
            ← تغيير البريد الإلكتروني
          </button>
        </>
      )}

      {step === 'password' && (
        <>
          <label className="pi-auth-label" htmlFor="fp-password">كلمة المرور الجديدة</label>
          <div className="pi-auth-input-wrap">
            <input
              id="fp-password"
              className="pi-auth-input has-toggle"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 أحرف على الأقل"
              dir="ltr"
              autoComplete="new-password"
            />
            <button
              type="button"
              className="pi-auth-input-toggle"
              onClick={() => setShowPass(!showPass)}
              aria-label="إظهار كلمة المرور"
            >
              {showPass ? '🙈' : '👁'}
            </button>
          </div>

          <label className="pi-auth-label" htmlFor="fp-confirm">تأكيد كلمة المرور</label>
          <div className="pi-auth-input-wrap">
            <input
              id="fp-confirm"
              className="pi-auth-input"
              type={showPass ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="أعد كتابة كلمة المرور"
              onKeyDown={(e) => e.key === 'Enter' && resetPassword()}
              dir="ltr"
              autoComplete="new-password"
            />
          </div>
          {confirm && confirm === password && (
            <p className="pi-auth-success" style={{ marginBottom: 12 }}>
              ✓ كلمتا المرور متطابقتان
            </p>
          )}

          <button
            type="button"
            className="pi-auth-btn pi-auth-btn-email"
            onClick={resetPassword}
            disabled={loading || !password || !confirm}
          >
            {loading ? (
              <>
                <span className="pi-auth-spinner" /> جاري الحفظ...
              </>
            ) : (
              'تعيين كلمة المرور'
            )}
          </button>
        </>
      )}

      {step === 'done' && (
        <div className="pi-auth-done">
          <div className="pi-auth-done-icon">🎉</div>
          <h3 style={{ color: '#fff', margin: '0 0 8px', fontSize: '1.1rem' }}>تم بنجاح!</h3>
          <p className="pi-auth-hint">
            تم تغيير كلمة مرورك. سيتم توجيهك لتسجيل الدخول...
          </p>
          <span className="pi-auth-spinner" style={{ marginTop: 16 }} />
          <Link href="/login?site=full" className="pi-auth-footer-link" style={{ marginTop: 16 }}>
            الذهاب لتسجيل الدخول الآن
          </Link>
        </div>
      )}
    </AuthLayout>
  )
}
