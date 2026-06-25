'use client'
// src/app/dashboard/facility/overview/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import DashboardShell from '@/components/dashboard/DashboardShell'
import Link from 'next/link'

interface Stats {
  totalDoctors:      number
  totalAppointments: number
  pendingAppointments: number
  completedAppointments: number
  averageRating:     number
  totalReviews:      number
}

export default function FacilityOverviewPage() {
  const { data: session, status } = useSession()
  const router  = useRouter()
  const tf = useTranslations('dashboard.facility')
  const ta = useTranslations('dashboard.admin')
  const td = useTranslations('dashboard')
  const [stats, setStats]     = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [aptRes, docRes] = await Promise.all([
        fetch('/api/appointments?limit=100'),
        fetch('/api/facility/doctors'),
      ])
      const [aptData, docData] = await Promise.all([aptRes.json(), docRes.json()])

      const apts = aptData.data ?? []
      setStats({
        totalDoctors:          (docData.data ?? []).length,
        totalAppointments:     apts.length,
        pendingAppointments:   apts.filter((a: { status: string }) => a.status === 'PENDING').length,
        completedAppointments: apts.filter((a: { status: string }) => a.status === 'COMPLETED').length,
        averageRating:         0,
        totalReviews:          0,
      })
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && session.user.role !== 'FACILITY') { router.push('/unauthorized'); return }
    void fetchData()
  }, [session, status, router, fetchData])

  const statCards = stats ? [
    { label: tf('stat_doctors'),          value: stats.totalDoctors,          icon: '👨‍⚕️', color: 'text-blue-400' },
    { label: tf('stat_total_appointments'), value: stats.totalAppointments, icon: '📅', color: 'text-emerald-400' },
    { label: tf('stat_pending'),          value: stats.pendingAppointments,   icon: '⏳', color: 'text-amber-400' },
    { label: tf('stat_completed'),        value: stats.completedAppointments, icon: '✅', color: 'text-teal-400' },
  ] : []

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">{tf('overview_title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{tf('overview_subtitle')}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {statCards.map(s => (
                <div key={s.label} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-slate-400 text-sm mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/dashboard/facility/departments"
                className="bg-white/[0.03] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 flex items-center gap-4 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🏢
                </div>
                <div>
                  <p className="text-white font-medium">{tf('departments_title')}</p>
                  <p className="text-slate-400 text-sm">{tf('departments_subtitle')}</p>
                </div>
              </Link>

              <Link href="/dashboard/facility/on-call"
                className="bg-white/[0.03] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 flex items-center gap-4 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  📅
                </div>
                <div>
                  <p className="text-white font-medium">{tf('on_call_title')}</p>
                  <p className="text-slate-400 text-sm">{tf('on_call_subtitle')}</p>
                </div>
              </Link>

              <Link href="/dashboard/facility/department-doctors"
                className="bg-white/[0.03] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 flex items-center gap-4 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  👨‍⚕️
                </div>
                <div>
                  <p className="text-white font-medium">{tf('dept_doctors_title')}</p>
                  <p className="text-slate-400 text-sm">{tf('dept_doctors_subtitle')}</p>
                </div>
              </Link>

              <Link href="/dashboard/facility/doctors"
                className="bg-white/[0.03] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 flex items-center gap-4 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  👨‍⚕️
                </div>
                <div>
                  <p className="text-white font-medium">{td('manage_doctors')}</p>
                  <p className="text-slate-400 text-sm">{ta('manage_doctors_desc')}</p>
                </div>
              </Link>

              <Link href="/dashboard/facility/appointments"
                className="bg-white/[0.03] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 flex items-center gap-4 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  📅
                </div>
                <div>
                  <p className="text-white font-medium">{tf('appointments_title')}</p>
                  <p className="text-slate-400 text-sm">{ta('appointments_desc')}</p>
                </div>
              </Link>

              <Link href="/dashboard/facility/settings"
                className="bg-white/[0.03] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 flex items-center gap-4 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  ⚙️
                </div>
                <div>
                  <p className="text-white font-medium">{tf('settings_title')}</p>
                  <p className="text-slate-400 text-sm">{tf('settings_subtitle')}</p>
                </div>
              </Link>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}
