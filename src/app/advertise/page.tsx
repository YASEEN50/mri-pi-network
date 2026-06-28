'use client'

import { useState } from 'react'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'

export default function AdvertisePage() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    linkUrl: '',
    advertiserName: '',
    advertiserEmail: '',
    advertiserPhone: '',
    imageUrl: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/ads/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          description: form.description || undefined,
          advertiserPhone: form.advertiserPhone || undefined,
          imageUrl: form.imageUrl || undefined,
        }),
      })
      const data = await res.json()
      if (data.data?.error || data.error) {
        setResult({ type: 'error', msg: data.data?.message ?? data.error?.message ?? 'حدث خطأ' })
      } else {
        setResult({
          type: 'success',
          msg: data.data?.message ?? 'تم إرسال طلبك بنجاح',
        })
        setForm({
          title: '',
          description: '',
          linkUrl: '',
          advertiserName: '',
          advertiserEmail: '',
          advertiserPhone: '',
          imageUrl: '',
        })
      }
    } catch {
      setResult({ type: 'error', msg: 'خطأ في الاتصال' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">إعلان مدفوع في MRI</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            اعرض خدماتك أو منتجاتك الطبية في الشريط الجانبي للصفحة الرئيسية. يُراجع كل إعلان قبل النشر
            ويتم تفعيله بعد الدفع والموافقة.
          </p>
        </div>

        <div className="mpi-card p-6 mb-6">
          <h2 className="text-white font-semibold mb-3">المميزات</h2>
          <ul className="text-slate-400 text-sm space-y-2 list-disc list-inside">
            <li>ظهور في الصفحة الرئيسية بجانب منشورات الأطباء</li>
            <li>استهداف زوار المنصة الطبية</li>
            <li>تتبع النقرات</li>
            <li>مراجعة إدارية قبل النشر</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="mpi-card p-6 space-y-4">
          {[
            { key: 'advertiserName', label: 'اسم المعلن / الشركة', required: true },
            { key: 'advertiserEmail', label: 'البريد الإلكتروني', type: 'email', required: true },
            { key: 'advertiserPhone', label: 'رقم الجوال (اختياري)' },
            { key: 'title', label: 'عنوان الإعلان', required: true },
            { key: 'linkUrl', label: 'رابط الإعلان (URL)', type: 'url', required: true },
            { key: 'imageUrl', label: 'رابط صورة الإعلان (اختياري)', type: 'url' },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-sm text-slate-300 mb-1.5">{field.label}</label>
              <input
                type={field.type ?? 'text'}
                required={field.required}
                value={form[field.key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/40"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">وصف قصير</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              maxLength={500}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/40 resize-none"
            />
          </div>

          {result && (
            <div
              className={`px-4 py-3 rounded-xl text-sm ${
                result.type === 'success'
                  ? 'bg-success/10 border border-success/20 text-success'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}
            >
              {result.msg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 transition-all"
          >
            {submitting ? 'جاري الإرسال...' : 'إرسال طلب الإعلان'}
          </button>
        </form>

        <p className="text-slate-500 text-xs text-center mt-6">
          للاستفسار:{' '}
          <Link href="/contact" className="text-accent hover:underline">
            اتصل بنا
          </Link>
        </p>
      </div>
    </div>
  )
}
