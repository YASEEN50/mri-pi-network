'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import PiLoginButton from '@/components/auth/PiLoginButton'
import { AuthLayout, AuthFooterLink } from '@/components/auth/AuthLayout'

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
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    value: 'DOCTOR',
    label: 'طبيب',
    description: 'أنا طبيب وأريد تقديم خدماتي الطبية',
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    value: 'FACILITY',
    label: 'منشأة',
    description: 'أمثل مركزاً طبياً أو مختبراً أو مؤسسة علمية',
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
]

const STRENGTH_COLORS = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e']

function passwordStrength(password: string) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step === 1) {
      setStep(2)
      return
    }

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

      router.push('/select-role')
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      subtitle="إنشاء حساب جديد"
      cardTitle="انضم إلى المنصة"
      hint={step === 1 ? 'اختر نوع الحساب' : 'أدخل بيانات الدخول'}
      error={error}
      footer={
        <AuthFooterLink href="/login">
          لديك حساب بالفعل؟ <strong style={{ color: 'var(--pi-accent)' }}>تسجيل الدخول</strong>
        </AuthFooterLink>
      }
    >
      <div className="pi-auth-steps">
        <div className={`pi-auth-step-dot ${step >= 1 ? 'active' : ''}`}>{step > 1 ? '✓' : '1'}</div>
        <div className={`pi-auth-step-line ${step > 1 ? 'done' : ''}`} />
        <div className={`pi-auth-step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
      </div>

      <form onSubmit={handleSubmit}>
        {step === 1 ? (
          <>
            {roles.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => setSelectedRole(role.value)}
                className={`pi-auth-role-btn ${selectedRole === role.value ? 'selected' : ''}`}
              >
                <div className="pi-auth-role-icon">{role.icon}</div>
                <div className="pi-auth-role-text" style={{ flex: 1 }}>
                  <strong>{role.label}</strong>
                  <span>{role.description}</span>
                </div>
              </button>
            ))}

            {(selectedRole === 'DOCTOR' || selectedRole === 'FACILITY') && (
              <div className="pi-auth-notice">
                {selectedRole === 'DOCTOR'
                  ? 'ستحتاج إلى رفع الشهادات العلمية ورخصة مزاولة المهنة. سيتم مراجعة طلبك من قِبَل فريقنا.'
                  : 'ستحتاج إلى رفع وثيقة ترخيص المنشأة. سيتم مراجعة طلبك من قِبَل فريقنا.'}
              </div>
            )}

            <button type="submit" className="pi-auth-btn pi-auth-btn-email">
              التالي ←
            </button>
          </>
        ) : (
          <>
            <label className="pi-auth-label" htmlFor="reg-email">البريد الإلكتروني</label>
            <div className="pi-auth-input-wrap">
              <input
                id="reg-email"
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

            <label className="pi-auth-label" htmlFor="reg-password">كلمة المرور</label>
            <div className="pi-auth-input-wrap">
              <input
                id="reg-password"
                className="pi-auth-input has-toggle"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8+ أحرف، حرف كبير ورقم"
                required
                dir="ltr"
                autoComplete="new-password"
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
            {password && (
              <>
                <div className="pi-auth-strength">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="pi-auth-strength-seg"
                      style={{
                        background: i <= strength ? STRENGTH_COLORS[strength] : undefined,
                      }}
                    />
                  ))}
                </div>
                <p className="pi-auth-strength-label">
                  قوة كلمة المرور: {strengthLabels[strength]}
                </p>
              </>
            )}

            <label className="pi-auth-label" htmlFor="reg-confirm">تأكيد كلمة المرور</label>
            <div className="pi-auth-input-wrap">
              <input
                id="reg-confirm"
                className="pi-auth-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                dir="ltr"
                autoComplete="new-password"
              />
            </div>
            {confirmPassword && confirmPassword !== password && (
              <p className="pi-auth-error" style={{ marginTop: 0, marginBottom: 12 }}>
                كلمتا المرور غير متطابقتين
              </p>
            )}

            <div className="pi-auth-btn-row">
              <button
                type="button"
                className="pi-auth-btn pi-auth-btn-outline"
                onClick={() => {
                  setStep(1)
                  setError('')
                }}
              >
                → رجوع
              </button>
              <button
                type="submit"
                className="pi-auth-btn pi-auth-btn-email"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="pi-auth-spinner" /> جاري الإنشاء...
                  </>
                ) : (
                  'إنشاء الحساب'
                )}
              </button>
            </div>
          </>
        )}
      </form>

      {step === 2 && (
        <>
          <div className="pi-auth-divider">أو</div>
          <PiLoginButton callbackUrl="/select-role" />
        </>
      )}
    </AuthLayout>
  )
}
