'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import OwnerSubpageLayout from '@/components/owner/OwnerSubpageLayout'

interface AdSettings {
  sidebarWeeklyPricePi: number
  sidebarMonthlyPricePi: number
  defaultDurationDays: number
  isAcceptingRequests: boolean
}

interface AdRow {
  id: string
  title: string
  description?: string | null
  linkUrl: string
  advertiserName: string
  advertiserEmail?: string | null
  advertiserPhone?: string | null
  imageUrl?: string | null
  status: string
  pricePi?: number | null
  durationDays?: number | null
  clickCount: number
  createdAt: string
  rejectionReason?: string | null
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'قيد المراجعة',
  ACTIVE: 'نشط',
  PAUSED: 'موقوف',
  EXPIRED: 'منتهي',
  REJECTED: 'مرفوض',
}

export default function OwnerAdsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<AdSettings>({
    sidebarWeeklyPricePi: 10,
    sidebarMonthlyPricePi: 25,
    defaultDurationDays: 30,
    isAcceptingRequests: true,
  })
  const [ads, setAds] = useState<AdRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, aRes] = await Promise.all([
        fetch('/api/owner/ad-settings'),
        fetch('/api/admin/ads'),
      ])
      const sData = await sRes.json()
      const aData = await aRes.json()
      if (sData.data && !sData.data.error) setSettings(sData.data)
      setAds(aData.data ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'OWNER') {
      router.push('/unauthorized')
      return
    }
    if (status === 'authenticated') void loadAll()
  }, [status, session, router, loadAll])

  async function saveSettings() {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/owner/ad-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      setMsg(data.data?.error ? '❌ فشل الحفظ' : '✅ تم حفظ أسعار الإعلانات')
    } catch {
      setMsg('❌ خطأ في الاتصال')
    } finally {
      setSaving(false)
    }
  }

  async function reviewAd(id: string, action: 'approve' | 'reject' | 'pause', extra?: { rejectionReason?: string }) {
    const res = await fetch('/api/admin/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        action,
        durationDays: settings.defaultDurationDays,
        pricePi: settings.sidebarMonthlyPricePi,
        ...extra,
      }),
    })
    const data = await res.json()
    if (data.data?.error) {
      setMsg(`❌ ${data.data.message ?? 'فشلت العملية'}`)
      return
    }
    setRejectId(null)
    setRejectReason('')
    setMsg(action === 'approve' ? '✅ تم نشر الإعلان' : action === 'reject' ? '✅ تم رفض الإعلان' : '✅ تم إيقاف الإعلان')
    void loadAll()
  }

  const pending = ads.filter((a) => a.status === 'PENDING_REVIEW')
  const active = ads.filter((a) => a.status === 'ACTIVE')

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <OwnerSubpageLayout
      title="إدارة الإعلانات المدفوعة"
      subtitle="تحديد الأسعار ومراجعة طلبات الإعلان قبل النشر"
      maxWidth="4xl"
    >
      {msg && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-slate-200">
          {msg}
        </div>
      )}

      {/* Pricing */}
      <div className="mpi-card p-6 mb-6 space-y-4">
        <h2 className="text-lg font-bold text-white">💰 أسعار الإعلان (π)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-slate-400 text-sm mb-1 block">سعر أسبوع — الشريط الجانبي</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={settings.sidebarWeeklyPricePi}
              onChange={(e) => setSettings((s) => ({ ...s, sidebarWeeklyPricePi: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
            />
          </label>
          <label className="block">
            <span className="text-slate-400 text-sm mb-1 block">سعر شهر — الشريط الجانبي</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={settings.sidebarMonthlyPricePi}
              onChange={(e) => setSettings((s) => ({ ...s, sidebarMonthlyPricePi: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
            />
          </label>
          <label className="block">
            <span className="text-slate-400 text-sm mb-1 block">مدة العرض الافتراضية (يوم)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={settings.defaultDurationDays}
              onChange={(e) => setSettings((s) => ({ ...s, defaultDurationDays: parseInt(e.target.value, 10) || 30 }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
            />
          </label>
          <label className="flex items-center gap-3 pt-6">
            <input
              type="checkbox"
              checked={settings.isAcceptingRequests}
              onChange={(e) => setSettings((s) => ({ ...s, isAcceptingRequests: e.target.checked }))}
              className="w-4 h-4"
            />
            <span className="text-slate-300 text-sm">قبول طلبات إعلانات جديدة</span>
          </label>
        </div>
        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ الأسعار'}
        </button>
      </div>

      {/* Pending review */}
      <div className="mpi-card p-6 mb-6">
        <h2 className="text-lg font-bold text-white mb-4">
          ⏳ بانتظار المراجعة ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-slate-500 text-sm">لا توجد طلبات جديدة</p>
        ) : (
          <div className="space-y-4">
            {pending.map((ad) => (
              <div key={ad.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-white font-semibold">{ad.title}</p>
                    <p className="text-slate-400 text-xs mt-1">{ad.advertiserName} · {ad.advertiserEmail}</p>
                    {ad.advertiserPhone && <p className="text-slate-500 text-xs">{ad.advertiserPhone}</p>}
                  </div>
                  <span className="text-amber-400 text-xs px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                    {STATUS_LABELS[ad.status]}
                  </span>
                </div>
                {ad.description && <p className="text-slate-400 text-sm mb-2">{ad.description}</p>}
                <p className="text-slate-500 text-xs mb-3 break-all">🔗 {ad.linkUrl}</p>
                <p className="text-slate-400 text-xs mb-3">
                  السعر المقترح: {ad.pricePi ?? settings.sidebarMonthlyPricePi} π · {ad.durationDays ?? settings.defaultDurationDays} يوم
                </p>
                {rejectId === ad.id ? (
                  <div className="space-y-2 mt-3">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                      placeholder="سبب الرفض..."
                      className="w-full bg-white/5 border border-red-500/20 rounded-xl px-3 py-2 text-white text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void reviewAd(ad.id, 'reject', { rejectionReason: rejectReason })}
                        disabled={rejectReason.trim().length < 5}
                        className="px-4 py-2 rounded-lg text-xs bg-red-500/20 text-red-400 border border-red-500/30 disabled:opacity-50"
                      >
                        تأكيد الرفض
                      </button>
                      <button type="button" onClick={() => setRejectId(null)} className="px-4 py-2 rounded-lg text-xs text-slate-400">
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void reviewAd(ad.id, 'approve')}
                      className="px-4 py-2 rounded-lg text-xs bg-success/20 text-success border border-success/30"
                    >
                      ✅ موافقة ونشر
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectId(ad.id)}
                      className="px-4 py-2 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20"
                    >
                      ❌ رفض
                    </button>
                    {ad.linkUrl && (
                      <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer"
                        className="px-4 py-2 rounded-lg text-xs text-slate-300 border border-white/10">
                        معاينة الرابط ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active ads */}
      <div className="mpi-card p-6">
        <h2 className="text-lg font-bold text-white mb-4">📢 إعلانات نشطة ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-slate-500 text-sm">لا توجد إعلانات منشورة</p>
        ) : (
          <div className="space-y-3">
            {active.map((ad) => (
              <div key={ad.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div>
                  <p className="text-white text-sm font-medium">{ad.title}</p>
                  <p className="text-slate-500 text-xs">👆 {ad.clickCount} نقرة</p>
                </div>
                <button
                  type="button"
                  onClick={() => void reviewAd(ad.id, 'pause')}
                  className="px-3 py-1.5 rounded-lg text-xs text-amber-400 border border-amber-500/30"
                >
                  إيقاف
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </OwnerSubpageLayout>
  )
}
