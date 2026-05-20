'use client'
// src/app/dashboard/doctor/analytics/page.tsx

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/common/Navbar'

export default function DoctorAnalyticsPage() {
  const { data: session, status } = useSession()
  const router  = useRouter()
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && session.user.role !== 'DOCTOR') { router.push('/unauthorized'); return }
    fetch('/api/analytics/doctor')
      .then(r => r.json())
      .then(d => setData(d.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session, status, router])

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  const o = data?.overview ?? {}

  const cards = [
    { label: 'إجمالي المواعيد',  value: o.totalAppointments ?? 0,  color: 'text-white',       sub: `${o.monthGrowth > 0 ? '+' : ''}${o.monthGrowth ?? 0}% هذا الشهر` },
    { label: 'هذا الشهر',         value: o.monthAppointments ?? 0,  color: 'text-emerald-400', sub: `${o.weekAppointments ?? 0} هذا الأسبوع` },
    { label: 'نسبة الإكمال',      value: `${o.completionRate ?? 0}%`, color: 'text-blue-400',   sub: `${o.completedTotal ?? 0} مكتمل` },
    { label: 'قيد الانتظار',      value: o.pendingCount ?? 0,       color: 'text-amber-400',   sub: `${o.cancelledTotal ?? 0} ملغي` },
    { label: 'متوسط التقييم',     value: data?.reviews?.average ?? 0, color: 'text-yellow-400', sub: `${data?.reviews?.total ?? 0} تقييم` },
    { label: 'المنشورات',         value: data?.publications?.total ?? 0, color: 'text-violet-400', sub: 'منشورات نشطة' },
  ]

  const STATUS_COLORS: Record<string, string> = {
    COMPLETED: '#10b981', PENDING: '#f59e0b',
    CONFIRMED: '#3b82f6', CANCELLED: '#ef4444', NO_SHOW: '#64748b',
  }
  const STATUS_LABELS: Record<string, string> = {
    COMPLETED: 'مكتمل', PENDING: 'معلق',
    CONFIRMED: 'مؤكد', CANCELLED: 'ملغي', NO_SHOW: 'لم يحضر',
  }

  const statusData = data?.appointmentsByStatus ?? {}
  const totalStatus = Object.values(statusData).reduce((s: number, v: any) => s + v, 0) as number

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">إحصائياتي</h1>
          <p className="text-slate-400 text-sm mt-1">نظرة تحليلية على نشاطك الطبي</p>
        </div>

        {/* بطاقات الإحصاء */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {cards.map(c => (
            <div key={c.label} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <p className="text-slate-400 text-xs mb-2">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-slate-500 text-xs mt-1">{c.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {/* توزيع المواعيد */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4 text-sm">توزيع المواعيد حسب الحالة</h3>
            <div className="space-y-3">
              {Object.entries(statusData).map(([status, count]: [string, any]) => {
                const pct = totalStatus > 0 ? Math.round((count / totalStatus) * 100) : 0
                return (
                  <div key={status}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">{STATUS_LABELS[status] ?? status}</span>
                      <span className="text-slate-400">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: STATUS_COLORS[status] ?? '#64748b' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* آخر المواعيد */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4 text-sm">آخر المواعيد</h3>
            <div className="space-y-3">
              {(data?.recentAppointments ?? []).map((apt: any) => (
                <div key={apt.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm">{apt.clientName}</p>
                    <p className="text-slate-500 text-xs">
                      {new Date(apt.scheduledAt).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full"
                    style={{ background: (STATUS_COLORS[apt.status] ?? '#64748b') + '20', color: STATUS_COLORS[apt.status] ?? '#64748b' }}>
                    {STATUS_LABELS[apt.status] ?? apt.status}
                  </span>
                </div>
              ))}
              {!data?.recentAppointments?.length && (
                <p className="text-slate-500 text-sm text-center py-4">لا توجد مواعيد بعد</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
