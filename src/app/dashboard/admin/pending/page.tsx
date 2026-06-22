'use client'
// src/app/dashboard/admin/pending/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'
import DashboardBreadcrumb, { getAdminDashboardHref, getAdminDashboardLabel } from '@/components/admin/DashboardBreadcrumb'

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
}

type Tab = 'doctors' | 'facilities'

export default function AdminPendingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
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
    const reason = prompt('سبب الرفض:')
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
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <DashboardBreadcrumb items={[{ label: 'الطلبات المعلقة' }]} />

        <div className="flex flex-wrap items-center justify-between gap-3 mb-8 mt-2">
          <div>
            <h1 className="text-2xl font-bold text-white">الطلبات المعلقة</h1>
            <p className="text-slate-400 text-sm mt-1">طلبات تسجيل بانتظار الموافقة</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={dashboardHref}
              className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-sm transition-all">
              ← {dashboardLabel}
            </Link>
            <Link href="/admin/verification-v2"
              className="px-4 py-2 bg-primary/20 border border-primary/30 text-accent rounded-xl text-sm transition-all hover:bg-primary/30">
              🔍 التحقق المتقدم (v2)
            </Link>
          </div>
        </div>

        {/* تبويبات */}
        <div className="flex gap-3 mb-6">
          {(['doctors','facilities'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-all
                ${tab === t
                  ? 'bg-primary/20 border-primary/30 text-accent'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
              {t === 'doctors' ? '👨‍⚕️ الأطباء' : '🏥 المنشآت'}
              <span className={`mr-2 text-xs px-2 py-0.5 rounded-full
                ${tab === t ? 'bg-primary/30 text-accent' : 'bg-white/10 text-slate-500'}`}>
                {t === 'doctors' ? totals.doctors : totals.facilities}
              </span>
            </button>
          ))}
        </div>

        {/* الجدول */}
        <div className="mpi-card rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-slate-400">لا توجد طلبات معلقة</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  {['الاسم', 'التخصص / النوع', 'الرخصة', 'المدينة', 'البريد', 'التاريخ', 'إجراء'].map(h => (
                    <th key={h} className="text-right text-slate-400 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-white/[0.05] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white font-medium">{item.fullName ?? item.name}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{item.specialization ?? item.type}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">{item.licenseNumber}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{item.city ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{item.email}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(item.createdAt).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {tab === 'doctors' && (
                          <Link href={`/admin/doctors/${item.id}/verify`}
                            className="px-3 py-1 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-accent rounded-lg text-xs transition-all">
                            📄 المستندات
                          </Link>
                        )}
                        {tab === 'facilities' && (
                          <Link href={`/admin/facilities/${item.id}/verify`}
                            className="px-3 py-1 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-accent rounded-lg text-xs transition-all">
                            📄 المستندات
                          </Link>
                        )}
                        <button onClick={() => handleApprove(tab, item.id)}
                          className="px-3 py-1 bg-success/20 hover:bg-success/30 border border-success/30 text-success rounded-lg text-xs transition-all">
                          ✅ قبول
                        </button>
                        <button onClick={() => handleReject(tab, item.id)}
                          className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs transition-all">
                          ❌ رفض
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
