'use client'
// src/app/forgot-password/page.tsx
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const RESEND_SECONDS = 120 // عداد تنازلي 2 دقيقة

export default function ForgotPasswordPage() {
  const router = useRouter()

  // المراحل: email → otp → password → done
  const [step,        setStep]        = useState<'email'|'otp'|'password'|'done'>('email')
  const [email,       setEmail]       = useState('')
  const [otp,         setOtp]         = useState(['','','','','',''])
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [countdown,   setCountdown]   = useState(0)
  const [showPass,    setShowPass]    = useState(false)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const timerRef  = useRef<any>(null)

  // عداد تنازلي
  useEffect(() => {
    if (countdown <= 0) return
    timerRef.current = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [countdown])

  // --- إرسال البريد ---
  async function sendOtp() {
    if (!email) return
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.data?.error) { setError(data.data.message); return }
      setStep('otp')
      setCountdown(RESEND_SECONDS)
    } catch { setError('خطأ في الاتصال') }
    finally { setLoading(false) }
  }

  // إعادة إرسال
  async function resendOtp() {
    if (countdown > 0) return
    setLoading(true); setError('')
    try {
      await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      setOtp(['','','','','',''])
      setCountdown(RESEND_SECONDS)
      setError('')
    } catch {}
    finally { setLoading(false) }
  }

  // --- إدخال OTP ---
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
    const text = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6)
    if (text.length === 6) {
      setOtp(text.split(''))
      inputsRef.current[5]?.focus()
    }
    e.preventDefault()
  }

  async function verifyOtp() {
    const code = otp.join('')
    if (code.length < 6) { setError('أدخل الرمز كاملاً'); return }
    setLoading(true); setError('')
    // نتحقق من الرمز عند تغيير كلمة المرور فعلياً
    setStep('password')
    setLoading(false)
  }

  // --- تغيير كلمة المرور ---
  async function resetPassword() {
    if (password.length < 8) { setError('كلمة المرور 8 أحرف على الأقل'); return }
    if (password !== confirm) { setError('كلمتا المرور غير متطابقتين'); return }
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, otp: otp.join(''), password }),
      })
      const data = await res.json()
      if (data.data?.error) { setError(data.data.message); return }
      setStep('done')
      setTimeout(() => router.push('/login'), 3000)
    } catch { setError('خطأ في الاتصال') }
    finally { setLoading(false) }
  }

  const formatTime = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{background:'#080c14'}} dir="rtl">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-3"
            style={{background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.3)'}}>
            🔐
          </div>
          <h1 className="text-2xl font-bold text-white">إعادة تعيين كلمة المرور</h1>
          <p className="text-slate-400 text-sm mt-1">المنصة الطبية</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {['البريد','الرمز','كلمة المرور'].map((label, i) => {
            const stepIndex = {email:0,otp:1,password:2,done:3}[step] ?? 0
            const active  = i === stepIndex
            const done    = i < stepIndex
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="h-1 w-full rounded-full transition-all"
                  style={{background: done||active ? '#10b981' : 'rgba(255,255,255,0.1)'}} />
                <span className="text-xs" style={{color: done||active ? '#34d399' : '#475569'}}>{label}</span>
              </div>
            )
          })}
        </div>

        <div className="rounded-2xl p-6" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>

          {/* خطأ */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171'}}>
              {error}
            </div>
          )}

          {/* ═══ مرحلة البريد ═══ */}
          {step === 'email' && (
            <div className="space-y-4">
              <div>
                <p className="text-slate-300 text-sm mb-4">أدخل بريدك الإلكتروني وسنرسل رمز التحقق المكون من 6 أرقام.</p>
                <label className="block text-slate-300 text-sm mb-2">البريد الإلكتروني</label>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendOtp()}
                  placeholder="example@email.com"
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none transition-all"
                  style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)'}}
                />
              </div>
              <button onClick={sendOtp} disabled={loading || !email}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
                style={{background:'linear-gradient(135deg,#10b981,#0891b2)'}}>
                {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
              </button>
              <div className="text-center">
                <Link href="/login" className="text-slate-400 hover:text-white text-sm transition-colors">
                  ← العودة لتسجيل الدخول
                </Link>
              </div>
            </div>
          )}

          {/* ═══ مرحلة OTP ═══ */}
          {step === 'otp' && (
            <div className="space-y-5">
              <div>
                <p className="text-slate-300 text-sm mb-1">أدخل الرمز المرسل إلى</p>
                <p className="font-medium mb-4 text-sm" style={{color:'#34d399'}} dir="ltr">{email}</p>

                {/* خانات OTP */}
                <div className="flex gap-2 justify-center mb-2" dir="ltr">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { inputsRef.current[i] = el }}
                      type="text" inputMode="numeric"
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      onPaste={i === 0 ? handleOtpPaste : undefined}
                      maxLength={1}
                      className="w-11 h-12 text-center text-white text-xl font-bold rounded-xl focus:outline-none transition-all"
                      style={{
                        background: digit ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                        border: digit ? '2px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.12)',
                      }}
                    />
                  ))}
                </div>

                {/* مدة الصلاحية */}
                <p className="text-center text-xs mt-3" style={{color:'#64748b'}}>
                  الرمز صالح لمدة <span style={{color:'#f59e0b'}}>15 دقيقة</span>
                </p>
              </div>

              {/* عداد إعادة الإرسال */}
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-sm" style={{color:'#64748b'}}>
                    إعادة الإرسال بعد{' '}
                    <span className="font-mono font-bold" style={{color:'#f59e0b'}}>{formatTime(countdown)}</span>
                  </p>
                ) : (
                  <button onClick={resendOtp} disabled={loading}
                    className="text-sm transition-colors disabled:opacity-50"
                    style={{color:'#34d399'}}>
                    {loading ? 'جاري الإرسال...' : '↻ إعادة إرسال الرمز'}
                  </button>
                )}
              </div>

              <button onClick={verifyOtp} disabled={loading || otp.join('').length < 6}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
                style={{background:'linear-gradient(135deg,#10b981,#0891b2)'}}>
                {loading ? 'جاري التحقق...' : 'تحقق من الرمز'}
              </button>

              <button onClick={() => setStep('email')} className="w-full text-center text-sm transition-colors" style={{color:'#64748b'}}>
                ← تغيير البريد الإلكتروني
              </button>
            </div>
          )}

          {/* ═══ مرحلة كلمة المرور ═══ */}
          {step === 'password' && (
            <div className="space-y-4">
              <p className="text-slate-300 text-sm">أدخل كلمة المرور الجديدة</p>

              <div>
                <label className="block text-slate-300 text-sm mb-2">كلمة المرور الجديدة</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="8 أحرف على الأقل"
                    className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none transition-all"
                    style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)'}}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs">
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
                {/* قوة كلمة المرور */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="flex-1 h-1 rounded-full transition-all"
                          style={{background: i <= (password.length >= 12 ? 4 : password.length >= 10 ? 3 : password.length >= 8 ? 2 : 1) ? ['','#ef4444','#f59e0b','#3b82f6','#10b981'][i] : 'rgba(255,255,255,0.1)'}} />
                      ))}
                    </div>
                    <p className="text-xs mt-1" style={{color:'#64748b'}}>
                      {password.length < 8 ? 'ضعيفة جداً' : password.length < 10 ? 'مقبولة' : password.length < 12 ? 'جيدة' : 'قوية ✓'}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 text-sm mb-2">تأكيد كلمة المرور</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور"
                  onKeyDown={e => e.key === 'Enter' && resetPassword()}
                  className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none transition-all"
                  style={{
                    background:'rgba(255,255,255,0.05)',
                    border: confirm && confirm !== password ? '1px solid rgba(239,68,68,0.5)' : confirm && confirm === password ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                />
                {confirm && confirm === password && (
                  <p className="text-xs mt-1" style={{color:'#34d399'}}>✓ كلمتا المرور متطابقتان</p>
                )}
              </div>

              <button onClick={resetPassword} disabled={loading || !password || !confirm}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
                style={{background:'linear-gradient(135deg,#10b981,#0891b2)'}}>
                {loading ? 'جاري الحفظ...' : 'تعيين كلمة المرور'}
              </button>
            </div>
          )}

          {/* ═══ مرحلة النجاح ═══ */}
          {step === 'done' && (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-white font-bold text-lg mb-2">تم بنجاح!</h3>
              <p className="text-slate-400 text-sm mb-4">تم تغيير كلمة مرورك. سيتم توجيهك لتسجيل الدخول...</p>
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
