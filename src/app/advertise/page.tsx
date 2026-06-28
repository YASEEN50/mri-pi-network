'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'
import { payForAdvertisement, piPaymentErrorMessage } from '@/lib/pi/pi-payment-client'

interface Pricing {
  sidebarWeeklyPricePi: number
  sidebarMonthlyPricePi: number
  defaultDurationDays: number
  isAcceptingRequests: boolean
}

type AdPlan = 'WEEKLY' | 'MONTHLY'

export default function AdvertisePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [pricing, setPricing] = useState<Pricing | null>(null)
  const [adPlan, setAdPlan] = useState<AdPlan>('MONTHLY')
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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/advertise')
    }
  }, [status, router])

  useEffect(() => {
    fetch('/api/ads/pricing')
      .then((r) => r.json())
      .then((d) => { if (d.data) setPricing(d.data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (session?.user?.email && !form.advertiserEmail) {
      setForm((f) => ({ ...f, advertiserEmail: session.user!.email! }))
    }
  }, [session, form.advertiserEmail])

  const selectedPrice =
    pricing == null
      ? null
      : adPlan === 'WEEKLY'
        ? pricing.sidebarWeeklyPricePi
        : pricing.sidebarMonthlyPricePi

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status !== 'authenticated') {
      router.push('/login?callbackUrl=/advertise')
      return
    }
    if (!pricing?.isAcceptingRequests) {
      setResult({ type: 'error', msg: 'استقبال طلبات الإعلان متوقف حالياً' })
      return
    }

    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/ads/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          description: form.description || undefined,
          advertiserPhone: form.advertiserPhone || undefined,
          imageUrl: form.imageUrl || undefined,
          adPlan,
        }),
      })
      const data = await res.json()
      const payload = data.data ?? data
      if (payload?.error || data.error) {
        setResult({ type: 'error', msg: payload?.message ?? data.error?.message ?? 'حدث خطأ' })
        return
      }

      const { id, pricePi } = payload as { id: string; pricePi: number }

      await payForAdvertisement(id, pricePi, adPlan, form.title)

      setResult({
        type: 'success',
        msg: '✅ تم الدفع بنجاح — طلبك بانتظار مراجعة الإدارة قبل النشر',
      })
      setForm({
        title: '',
        description: '',
        linkUrl: '',
        advertiserName: '',
        advertiserEmail: session?.user?.email ?? '',
        advertiserPhone: '',
        imageUrl: '',
      })
    } catch (err) {
      setResult({ type: 'error', msg: piPaymentErrorMessage(err) })
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">إعلان مدفوع في MRI</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            اعرض خدماتك أو منتجاتك الطبية في الشريط الجانبي للصفحة الرئيسية. يُراجع كل إعلان قبل النشر
            بعد الدفع بعملة Pi.
          </p>
        </div>

        <div className="mpi-card p-6 mb-6">
          <h2 className="text-white font-semibold mb-3">اختر مدة الإعلان</h2>
          {pricing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { key: 'WEEKLY' as const, label: 'أسبوع', price: pricing.sidebarWeeklyPricePi, days: 7 },
                { key: 'MONTHLY' as const, label: 'شهر', price: pricing.sidebarMonthlyPricePi, days: pricing.defaultDurationDays },
              ]).map((plan) => (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() => setAdPlan(plan.key)}
                  className={`p-4 rounded-xl border text-right transition-all ${
                    adPlan === plan.key
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  }`}
                >
                  <p className="text-white font-semibold">{plan.label}</p>
                  <p className="text-amber-300 text-lg font-bold mt-1">{plan.price} π</p>
                  <p className="text-slate-500 text-xs mt-1">{plan.days} يوم عرض</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">جاري تحميل الأسعار...</p>
          )}
          {!pricing?.isAcceptingRequests && pricing && (
            <p className="text-red-400 text-sm mt-3">⚠️ استقبال الطلبات متوقف مؤقتاً</p>
          )}
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
            disabled={submitting || !pricing?.isAcceptingRequests}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 transition-all"
          >
            {submitting
              ? 'جاري الدفع عبر Pi...'
              : selectedPrice != null
                ? `الدفع ${selectedPrice} π وإرسال الطلب`
                : 'إرسال طلب الإعلان'}
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
