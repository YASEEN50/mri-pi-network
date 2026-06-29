'use client'
// src/app/dashboard/doctor/analytics/page.tsx

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { useAppLocale } from '@/hooks/useAppLocale'

export default function DoctorAnalyticsPage() {
  const { data: session, status } = useSession()
  const router  = useRouter()
  const t = useTranslations()
  const tdoc = useTranslations('dashboard.doctor')
  const tp = useTranslations('premio')
  const { dateLocale } = useAppLocale()
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
  const locked: string[] = data?.lockedFeatures ?? []
  const isLocked = (key: string) => locked.includes(key)

  const cards = [
    { label: tdoc('stats_total'),  value: o.totalAppointments ?? 0,  color: 'text-white',       sub: o.monthGrowth != null ? tdoc('stats_month_growth', { pct: `${o.monthGrowth > 0 ? '+' : ''}${o.monthGrowth ?? 0}` }) : tdoc('stats_this_week', { count: o.weekAppointments ?? 0 }) },
    { label: tdoc('stats_month'),  value: o.monthAppointments ?? 0,  color: 'text-emerald-400', sub: tdoc('stats_this_week', { count: o.weekAppointments ?? 0 }) },
    { label: tdoc('stats_completion'), value: `${o.completionRate ?? 0}%`, color: 'text-blue-400', sub: tdoc('stats_completed_sub', { count: o.completedTotal ?? 0 }) },
    { label: tdoc('stats_pending'), value: o.pendingCount ?? 0, color: 'text-amber-400', sub: tdoc('stats_cancelled_sub', { count: o.cancelledTotal ?? 0 }) },
    { label: tdoc('stats_rating'), value: data?.reviews?.average ?? 0, color: 'text-yellow-400', sub: tdoc('stats_reviews_sub', { count: data?.reviews?.total ?? 0 }) },
    ...(!isLocked('publications') ? [{ label: tdoc('stats_publications'), value: data?.publications?.total ?? 0, color: 'text-violet-400', sub: tdoc('stats_publications_sub') }] : []),
    { label: tdoc('stats_pi_balance'), value: `${(data?.earnings?.piBalance ?? 0).toFixed(4)} π`, color: 'text-purple-400', sub: tdoc('stats_pi_commission') },
  ]

  const STATUS_COLORS: Record<string, string> = {
    COMPLETED: '#10b981', PENDING: '#f59e0b',
    CONFIRMED: '#3b82f6', CANCELLED: '#ef4444', NO_SHOW: '#64748b',
  }

  const statusData = data?.appointmentsByStatus ?? {}
  const totalStatus = Object.values(statusData).reduce((s: number, v: unknown) => s + (v as number), 0)

  const tierLabel = (tier: string) => {
    if (tier === 'PRO') return tp('tier_pro')
    if (tier === 'ELITE') return tp('tier_elite')
    return tp('tier_basic')
  }

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">{tdoc('analytics_title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{tdoc('analytics_subtitle')}</p>
            {data?.premioTier && (
              <p className="text-emerald-400/80 text-xs mt-2">{tp('current_tier', { tier: tierLabel(data.premioTier) })}</p>
            )}
          </div>
          {locked.length > 0 && (
            <Link href="/dashboard/doctor/premio"
              className="px-4 py-2 bg-violet-500/20 border border-violet-500/30 text-violet-300 rounded-xl text-sm hover:bg-violet-500/30 transition-all">
              💎 {tp('upgrade_hint')}
            </Link>
          )}
          <Link href="/dashboard/doctor/withdrawals"
            className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm hover:bg-emerald-500/30 transition-all">
            💸 سحب المستحقات
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {cards.map(c => (
            <div key={c.label} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <p className="text-slate-400 text-xs mb-2">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-slate-500 text-xs mt-1">{c.sub}</p>
            </div>
          ))}
        </div>

        {data?.referrals && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: tp('referrals_sent'), value: data.referrals.sent },
              { label: tp('referrals_completed'), value: data.referrals.completed },
              { label: tp('referrals_rewards'), value: `${data.referrals.rewardsEarned.toFixed(2)} π` },
            ].map(c => (
              <div key={c.label} className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
                <p className="text-slate-400 text-xs mb-2">{c.label}</p>
                <p className="text-2xl font-bold text-amber-300">{c.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {!isLocked('statusBreakdown') ? (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4 text-sm">{tdoc('status_distribution')}</h3>
              <div className="space-y-3">
                {Object.entries(statusData).map(([status, count]) => {
                  const pct = totalStatus > 0 ? Math.round(((count as number) / totalStatus) * 100) : 0
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{t(`appointment.status.${status}` as 'appointment.status.PENDING')}</span>
                        <span className="text-slate-400">{count as number} ({pct}%)</span>
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
          ) : (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 flex items-center justify-center text-center">
              <p className="text-slate-500 text-sm">🔒 {tp('upgrade_hint')}</p>
            </div>
          )}

          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4 text-sm">{tdoc('recent_appointments')}</h3>
            <div className="space-y-3">
              {(data?.recentAppointments ?? []).map((apt: { id: string; clientName?: string; scheduledAt: string; status: string }) => (
                <div key={apt.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm">{apt.clientName}</p>
                    <p className="text-slate-500 text-xs">
                      {new Date(apt.scheduledAt).toLocaleDateString(dateLocale)}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full"
                    style={{ background: (STATUS_COLORS[apt.status] ?? '#64748b') + '20', color: STATUS_COLORS[apt.status] ?? '#64748b' }}>
                    {t(`appointment.status.${apt.status}` as 'appointment.status.PENDING')}
                  </span>
                </div>
              ))}
              {!data?.recentAppointments?.length && (
                <p className="text-slate-500 text-sm text-center py-4">{t('appointment.no_appointments')}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
