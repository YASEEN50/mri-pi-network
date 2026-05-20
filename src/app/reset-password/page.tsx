'use client'
import Navbar from '@/components/common/Navbar'
// src/app/reset-password/page.tsx

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) router.push('/login')
  }, [token, router])

  async function handleReset() {
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }
    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      return
    }

    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (data.success && !data.data?.error) {
        setSuccess(true)
        setTimeout(() => router.push('/login'), 3000)
      } else {
        setError(data.data?.message || 'حدث خطأ')
      }
    } catch { setError('حدث خطأ في الاتصال') }
    finally { setIsLoading(false) }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8">

          {success ? (
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-white mb-2">تم تغيير كلمة المرور!</h2>
              <p className="text-slate-400 text-sm mb-2">سيتم توجيهك لصفحة تسجيل الدخول...</p>
              <Link href="/login" className="text-emerald-400 hover:text-emerald-300 text-sm">
                تسجيل الدخول الآن ←
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">إعادة تعيين كلمة المرور 🔑</h2>
                <p className="text-slate-400 text-sm mt-2">أدخل كلمة المرور الجديدة</p>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-slate-300 text-sm mb-2">كلمة المرور الجديدة</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="8 أحرف على الأقل"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-2">تأكيد كلمة المرور</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                    placeholder="أعد كتابة كلمة المرور"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                </div>
              </div>

              <button onClick={handleReset} disabled={isLoading || !password || !confirmPassword}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all">
                {isLoading ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}