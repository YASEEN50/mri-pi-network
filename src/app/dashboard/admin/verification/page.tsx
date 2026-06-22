'use client'
// src/app/dashboard/admin/verification/page.tsx

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'
import DashboardBreadcrumb from '@/components/admin/DashboardBreadcrumb'

type Tab = 'doctors' | 'facilities'

interface PendingDoctor {
  id: string
  fullName: string
  specialization: string
  licenseNumber: string
  credentialsCount: number
  city?: string
  country: string
}

interface PendingFacility {
  id: string
  name: string
  type: string
  licenseNumber: string
  city: string
  hasOwnershipDoc?: boolean
  hasLicenseDoc?: boolean
}

export default function AdminVerificationPage() {
  const t = useTranslations('admin')
  const [tab, setTab] = useState<Tab>('doctors')
  const [doctors, setDoctors] = useState<PendingDoctor[]>([])
  const [facilities, setFacilities] = useState<PendingFacility[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const [dr, fa] = await Promise.all([
        fetch('/api/admin/doctors/pending').then((r) => r.json()),
        fetch('/api/admin/facilities/pending').then((r) => r.json()),
      ])
      setDoctors(dr.data ?? [])
      setFacilities(fa.data ?? [])
      setIsLoading(false)
    }
    load()
  }, [])

  async function handleAction(type: 'doctor' | 'facility', id: string, action: 'approve' | 'reject') {
    const url = type === 'doctor'
      ? `/api/admin/doctors/${id}/approve`
      : `/api/admin/facilities/${id}/approve`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes: rejectNotes }),
    })

    if (res.ok) {
      if (type === 'doctor') setDoctors((prev) => prev.filter((d) => d.id !== id))
      else setFacilities((prev) => prev.filter((f) => f.id !== id))
      setRejectId(null)
      setRejectNotes('')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar locale="ar" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <DashboardBreadcrumb items={[{ label: 'التحقق من الطلبات' }]} />
        <h1 className="text-2xl font-bold text-white mb-8 mt-2">{t('verification' as any)}</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 p-1 bg-white/5 rounded-xl w-fit">
          {(['doctors', 'facilities'] as Tab[]).map((t_) => (
            <button key={t_} onClick={() => setTab(t_)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t_ ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'
              }`}>
              {t_ === 'doctors' ? `👨‍⚕️ ${t('pending_doctors')} (${doctors.length})` : `🏥 ${t('pending_facilities')} (${facilities.length})`}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : tab === 'doctors' ? (
          <div className="space-y-4">
            {doctors.length === 0 && <p className="text-slate-400 text-center py-10">لا توجد طلبات معلقة</p>}
            {doctors.map((d) => (
              <div key={d.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-white">{d.fullName}</h3>
                    <p className="text-accent text-sm">{d.specialization}</p>
                    <p className="text-slate-500 text-xs mt-1">رخصة: {d.licenseNumber} · {d.credentialsCount} شهادات</p>
                    {d.city && <p className="text-slate-500 text-xs">📍 {d.city}, {d.country}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleAction('doctor', d.id, 'approve')}
                      className="px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-accent rounded-xl text-sm font-medium transition-all">
                      ✓ {t('approve')}
                    </button>
                    <button onClick={() => setRejectId(rejectId === d.id ? null : d.id)}
                      className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-sm transition-all">
                      ✗ {t('reject')}
                    </button>
                  </div>
                </div>
                {rejectId === d.id && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)}
                      placeholder={t('rejection_reason')} rows={2}
                      className="w-full bg-white/5 border border-red-500/20 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none resize-none" />
                    <button onClick={() => handleAction('doctor', d.id, 'reject')}
                      disabled={rejectNotes.length < 10}
                      className="mt-2 px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm disabled:opacity-50 transition-all">
                      تأكيد الرفض
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {facilities.length === 0 && <p className="text-slate-400 text-center py-10">لا توجد طلبات معلقة</p>}
            {facilities.map((f) => (
              <div key={f.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-white">{f.name}</h3>
                    <p className="text-teal-400 text-sm">{f.type}</p>
                    <p className="text-slate-500 text-xs mt-1">ترخيص: {f.licenseNumber}</p>
                    <p className="text-slate-500 text-xs">📍 {f.city}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {f.hasOwnershipDoc ? '✅ ملكية' : '⏳ ملكية'} · {f.hasLicenseDoc ? '✅ تصريح' : '⏳ تصريح'}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    <Link href={`/admin/facilities/${f.id}/verify`}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 rounded-xl text-sm font-medium transition-all">
                      📄 المستندات
                    </Link>
                    <button onClick={() => handleAction('facility', f.id, 'approve')}
                      className="px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-accent rounded-xl text-sm font-medium transition-all">
                      ✓ {t('approve')}
                    </button>
                    <button onClick={() => setRejectId(rejectId === f.id ? null : f.id)}
                      className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-sm transition-all">
                      ✗ {t('reject')}
                    </button>
                  </div>
                </div>
                {rejectId === f.id && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)}
                      placeholder={t('rejection_reason')} rows={2}
                      className="w-full bg-white/5 border border-red-500/20 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none resize-none" />
                    <button onClick={() => handleAction('facility', f.id, 'reject')}
                      disabled={rejectNotes.length < 10}
                      className="mt-2 px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm disabled:opacity-50 transition-all">
                      تأكيد الرفض
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
