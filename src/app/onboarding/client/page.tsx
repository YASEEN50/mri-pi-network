'use client'
// src/app/onboarding/client/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { CountryCitySelect } from '@/components/geo/CountryCitySelect'

export default function ClientOnboardingPage() {
  const router = useRouter()
  const { update } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    country: 'SA',
    city: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit() {
    if (!form.fullName || !form.phone || !form.gender) {
      setError('يرجى تعبئة الحقول المطلوبة')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || data.data?.error) {
        setError(data.data?.message || 'حدث خطأ')
        return
      }
      await update({ isProfileComplete: true })
      router.push('/dashboard')
    } catch {
      setError('حدث خطأ في الاتصال')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🧑‍⚕️</div>
          <h1 className="text-2xl font-bold text-white">أكمل ملفك الشخصي</h1>
          <p className="text-slate-400 text-sm mt-1">بيانات أساسية لتجربة أفضل</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 space-y-4">
          {/* الاسم */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">الاسم الكامل <span className="text-red-400">*</span></label>
            <input name="fullName" value={form.fullName} onChange={handleChange}
              placeholder="محمد أحمد"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
          </div>

          {/* الجنس */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">الجنس <span className="text-red-400">*</span></label>
            <select name="gender" value={form.gender} onChange={handleChange}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50">
              <option value="" className="bg-slate-900">اختر</option>
              <option value="MALE" className="bg-slate-900">ذكر</option>
              <option value="FEMALE" className="bg-slate-900">أنثى</option>
            </select>
          </div>

          {/* الهاتف */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">رقم الهاتف <span className="text-red-400">*</span></label>
            <input name="phone" value={form.phone} onChange={handleChange}
              placeholder="+966 5XX XXX XXX" dir="ltr"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
          </div>

          {/* تاريخ الميلاد */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">تاريخ الميلاد</label>
            <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
          </div>

          <CountryCitySelect
            country={form.country}
            city={form.city}
            onCountryChange={country => setForm(prev => ({ ...prev, country, city: '' }))}
            onCityChange={city => setForm(prev => ({ ...prev, city }))}
            inputClassName="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50"
            labelClassName="block text-sm text-slate-300 mb-2"
          />

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={isLoading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all">
            {isLoading ? 'جاري الحفظ...' : 'إكمال التسجيل ←'}
          </button>
        </div>
      </div>
    </div>
  )
}