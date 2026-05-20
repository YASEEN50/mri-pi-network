'use client'
// src/app/onboarding/facility/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

const facilityTypes = [
  { value: 'CLINIC', label: 'عيادة' },
  { value: 'HOSPITAL', label: 'مستشفى' },
  { value: 'MEDICAL_CENTER', label: 'مركز طبي' },
  { value: 'LABORATORY', label: 'مختبر' },
  { value: 'PHARMACY', label: 'صيدلية' },
  { value: 'SCIENTIFIC_INSTITUTE', label: 'معهد علمي' },
  { value: 'UNIVERSITY', label: 'جامعة' },
  { value: 'MEDICAL_COLLEGE', label: 'كلية طب' },
]

export default function FacilityOnboardingPage() {
  const router = useRouter()
  const { update } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    type: '',
    phone: '',
    city: '',
    address: '',
    licenseNumber: '',
    description: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit() {
    if (!form.name || !form.type || !form.phone || !form.licenseNumber) {
      setError('يرجى تعبئة جميع الحقول المطلوبة')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/facility', {
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
      // توجيه صحيح بعد تسجيل المنشأة (ليس /doctor/pending)
      console.log('[onboarding/facility] facility saved, redirecting to /facility/pending')
      router.push('/facility/pending')
    } catch {
      setError('حدث خطأ في الاتصال')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏥</div>
          <h1 className="text-2xl font-bold text-white">تسجيل منشأة طبية</h1>
          <p className="text-slate-400 text-sm mt-1">أدخل بيانات المنشأة للمراجعة</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">اسم المنشأة <span className="text-red-400">*</span></label>
            <input name="name" value={form.name} onChange={handleChange}
              placeholder="مستشفى الرعاية الطبية"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/50" />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">نوع المنشأة <span className="text-red-400">*</span></label>
            <select name="type" value={form.type} onChange={handleChange}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/50">
              <option value="" className="bg-slate-900">اختر نوع المنشأة</option>
              {facilityTypes.map(t => (
                <option key={t.value} value={t.value} className="bg-slate-900">{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">رقم الهاتف <span className="text-red-400">*</span></label>
            <input name="phone" value={form.phone} onChange={handleChange}
              placeholder="+966 1XX XXX XXXX" dir="ltr"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/50" />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">رقم الترخيص <span className="text-red-400">*</span></label>
            <input name="licenseNumber" value={form.licenseNumber} onChange={handleChange}
              placeholder="رقم ترخيص المنشأة" dir="ltr"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/50" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">المدينة</label>
              <input name="city" value={form.city} onChange={handleChange}
                placeholder="الرياض"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">العنوان</label>
              <input name="address" value={form.address} onChange={handleChange}
                placeholder="حي النزهة"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/50" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">وصف المنشأة</label>
            <textarea name="description" value={form.description} onChange={handleChange}
              placeholder="اكتب وصفاً مختصراً عن المنشأة وخدماتها..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/50 resize-none" />
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-amber-400 text-xs">⚠️ سيتم مراجعة بيانات المنشأة وترخيصها خلال 1-3 أيام عمل</p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={isLoading}
            className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all">
            {isLoading ? 'جاري الإرسال...' : 'إرسال الطلب ←'}
          </button>
        </div>
      </div>
    </div>
  )
}
