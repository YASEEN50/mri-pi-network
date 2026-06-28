'use client'
// src/app/dashboard/admin/pending/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { useAppLocale } from '@/hooks/useAppLocale'
import Link from 'next/link'
import { getAdminDashboardHref, getAdminDashboardLabel } from '@/components/admin/DashboardBreadcrumb'

interface PendingItem {
  id: string
  fullName: string
  specialization?: string
  name?: string
  type?: string
  licenseNumber: string
  city?: string
  email: string
  createdAt: string
  approvalStatus: string
  hasOwnershipDoc?: boolean
  hasLicenseDoc?: boolean
}

type Tab = 'doctors' | 'facilities'

export default function AdminPendingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const t = useTranslations('admin')
  const ta = useTranslations('dashboard.admin')
  const { dateLocale } = useAppLocale()
  const [tab,       setTab]       = useState<Tab>('doctors')
  const [doctors,   setDoctors]   = useState<PendingItem[]>([])
  const [facilities,setFacilities]= useState<PendingItem[]>([])
  const [loading,   setLoading]   = useState(true)
  const [totals,    setTotals]    = useState({ doctors: 0, facilities: 0 })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [dRes, fRes] = await Promise.all([
        fetch('/api/admin/doctors/pending?limit=50'),
        fetch('/api/admin/facilities/pending?limit=50'),
      ])
      const [dData, fData] = await Promise.all([dRes.json(), fRes.json()])
      setDoctors(dData.data   ?? [])
      setFacilities(fData.data ?? [])
      setTotals({ doctors: dData.meta?.total ?? 0, facilities: fData.meta?.total ?? 0 })
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && !['ADMIN','OWNER'].includes(session.user.role)) { router.push('/unauthorized'); return }
    void fetchAll()
  }, [session, status, router, fetchAll])

  async function handleApprove(type: Tab, id: string) {
    const url = type === 'doctors'
      ? `/api/admin/doctors/${id}/approve`
      : `/api/admin/facilities/${id}/approve`
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }) })
    fetchAll()
  }

  async function handleReject(type: Tab, id: string) {
    const reason = prompt(ta('reject_reason_prompt'))
    if (!reason) return
    const url = type === 'doctors'
      ? `/api/admin/doctors/${id}/approve`
      : `/api/admin/facilities/${id}/approve`
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', notes: reason }) })
    fetchAll()
  }

  const items = tab === 'doctors' ? doctors : facilities
  const dashboardHref = getAdminDashboardHref(session?.user?.role)
  const dashboardLabel = getAdminDashboardLabel(session?.user?.role)

  return (
    <DashboardShell className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">{ta('pending_title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{ta('pending_subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={dashboardHref}
              className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-sm transition-all">
              ← {dashboardLabel}
            </Link>
            <Link href="/admin/verification-v2"
              className="px-4 py-2 bg-primary/20 border border-primary/30 text-accent rounded-xl text-sm transition-all hover:bg-primary/30">
              {ta('advanced_verification')}
            </Link>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          {(['doctors','facilities'] as Tab[]).map(tabKey => (
            <button key={tabKey} onClick={() => setTab(tabKey)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-all
                ${tab === tabKey
                  ? 'bg-primary/20 border-primary/30 text-accent'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
              {tabKey === 'doctors' ? ta('tab_doctors') : ta('tab_facilities')}
              <span className={`ms-2 text-xs px-2 py-0.5 rounded-full
                ${tab === tabKey ? 'bg-primary/30 text-accent' : 'bg-white/10 text-slate-500'}`}>
                {tabKey === 'doctors' ? totals.doctors : totals.facilities}
              </span>
            </button>
          ))}
        </div>

        <div className="mpi-card rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-slate-400">{ta('no_pending')}</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {items.map(item => {
                const name = item.fullName ?? item.name ?? '—'
                const profileHref = tab === 'doctors'
                  ? `/admin/doctors/${item.id}/verify`
                  : `/admin/facilities/${item.id}/verify`

                return (
                  <div key={item.id} className="p-4 sm:p-5 hover:bg-white/[0.02]">
                    <div className="flex flex-col gap-3">
                      <div className="min-w-0">
                        <Link href={profileHref}
                          className="text-white font-semibold text-base hover:text-accent transition-colors">
                          {name}
                        </Link>
                        {tab === 'facilities' && (
                          <p className="text-slate-500 text-xs font-normal mt-1">
                            {item.hasOwnershipDoc ? '✅ ملكية' : '⏳ ملكية'}
                            {' · '}
                            {item.hasLicenseDoc ? '✅ تصريح' : '⏳ تصريح'}
                          </p>
                        )}
                        <p className="text-slate-400 text-sm mt-1">
                          {item.specialization ?? item.type ?? '—'}
                          {' · '}
                          <span className="font-mono text-xs">{item.licenseNumber}</span>
                        </p>
                        <p className="text-slate-500 text-xs mt-1 truncate">
                          {item.city ?? '—'} · {item.email}
                        </p>
                        <p className="text-slate-600 text-xs mt-1">
                          {new Date(item.createdAt).toLocaleDateString(dateLocale)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link href={profileHref}
                          className="px-3 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-accent rounded-lg text-xs transition-all">
                          {ta('documents')}
                        </Link>
                        <button onClick={() => handleApprove(tab, item.id)}
                          className="px-3 py-2 bg-success/20 hover:bg-success/30 border border-success/30 text-success rounded-lg text-xs transition-all">
                          {ta('accept')}
                        </button>
                        <button onClick={() => handleReject(tab, item.id)}
                          className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs transition-all">
                          ❌ {t('reject')}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}
