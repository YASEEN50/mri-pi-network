'use client'
// src/app/dashboard/doctor/schedule/page.tsx
import { useTranslations } from 'next-intl'
import { useAppointments } from '@/hooks/useAppointments'
import DashboardShell from '@/components/dashboard/DashboardShell'
import VideoJoinButton from '@/components/appointments/VideoJoinButton'
import { useAppLocale } from '@/hooks/useAppLocale'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  CONFIRMED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function DoctorSchedulePage() {
  const t = useTranslations()
  const td = useTranslations('dashboard')
  const tdoc = useTranslations('dashboard.doctor')
  const tn = useTranslations('dashboard.nav')
  const { dateLocale } = useAppLocale()
  const { data: session } = useSession()
  const { appointments, total, isLoading, confirmAppointment, completeAppointment } = useAppointments()

  const profileApproved = session?.user?.approvalStatus === 'APPROVED'
  const [verifState, setVerifState] = useState<string | null>(null)
  const [piBalance, setPiBalance] = useState<number | null>(null)

  useEffect(() => {
    if (profileApproved) {
      setVerifState('APPROVED')
      return
    }
    fetch('/api/doctor/verification-status')
      .then(r => r.json())
      .then(d => setVerifState(d.data?.verificationStatus ?? 'UNVERIFIED'))
      .catch(() => {})
  }, [profileApproved])

  useEffect(() => {
    fetch('/api/doctor/withdrawals')
      .then(r => r.json())
      .then(d => {
        if (d.data?.balance != null) setPiBalance(Number(d.data.balance))
      })
      .catch(() => {})
  }, [])

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  const upcoming  = appointments.filter(a => ['PENDING','CONFIRMED'].includes(a.status))
  const completed = appointments.filter(a => a.status === 'COMPLETED')
  const isReviewPending = verifState === 'ADMIN_REVIEW' || verifState === 'PENDING_HUMAN'

  return (
    <DashboardShell>
      {verifState && !['APPROVED'].includes(verifState) && !profileApproved && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <Link href="/profile">
            <div className="flex items-center justify-between rounded-xl px-4 py-3 transition-all hover:opacity-90"
              style={{
                background: isReviewPending
                  ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${isReviewPending ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
              <div className="flex items-center gap-2">
                <span>{isReviewPending ? '⏳' : '⚠️'}</span>
                <span className="text-sm font-medium" style={{
                  color: isReviewPending ? '#fbbf24' : '#f87171'
                }}>
                  {isReviewPending ? tdoc('verification_review') : tdoc('verification_unverified')}
                </span>
              </div>
              <span className="text-slate-400 text-xs">{tdoc('verification_cta')}</span>
            </div>
          </Link>
        </div>
      )}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">{tdoc('schedule_title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{td('total_appointments', { count: total })}</p>
          </div>
          <div className="flex gap-3 text-sm">
            <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              {td('upcoming_count', { count: upcoming.length })}
            </div>
            <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              {td('completed_count', { count: completed.length })}
            </div>
          </div>
        </div>

        {piBalance != null && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25">
            <div>
              <p className="text-slate-400 text-xs">مستحقاتك (بعد عمولة 5%)</p>
              <p className="text-2xl font-bold text-purple-300" dir="ltr">{piBalance.toFixed(4)} π</p>
            </div>
            <Link
              href="/dashboard/doctor/withdrawals"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
            >
              💸 {tn('withdrawals')}
            </Link>
          </div>
        )}

        <div className="flex gap-3 mb-6 flex-wrap">
          <Link href="/dashboard/doctor/availability"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            {tn('availability')}
          </Link>
          <Link href="/dashboard/doctor/payment-settings"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            {tn('payment_settings')}
          </Link>
          <Link href="/dashboard/doctor/withdrawals"
            className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm transition-all">
            {tn('withdrawals')}
          </Link>
          <Link href="/dashboard/doctor/instant-consult"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            {tn('instant_consult')}
          </Link>
          <Link href="/dashboard/doctor/analytics"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            {tn('analytics')}
          </Link>
          <Link href="/dashboard/doctor/publications"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            {tn('publications')}
          </Link>
          <Link href="/dashboard/doctor/chat"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            {tn('chat')}
          </Link>
          <Link href="/dashboard/doctor/referrals"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            {tn('referrals')}
          </Link>
          <Link href="/dashboard/doctor/premio"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            {tn('premio')}
          </Link>
          <Link href="/profile"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            {tn('verification')}
          </Link>
        </div>

        {upcoming.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">{td('upcoming_section')}</h2>
            <div className="space-y-3">
              {upcoming.map(apt => (
                <div key={apt.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[apt.status]}`}>
                          {t(`appointment.status.${apt.status}` as 'appointment.status.PENDING')}
                        </span>
                        <span className="text-xs text-slate-500">
                          {apt.type === 'ONLINE' ? '💻' : '🏥'}
                        </span>
                      </div>
                      {apt.clientName && (
                        <p className="text-white font-medium text-sm mb-1">
                          {td('patient_label')}: {apt.clientName}
                        </p>
                      )}
                      <p className="text-slate-300 text-sm">
                        {new Date(apt.scheduledAt).toLocaleDateString(dateLocale, {
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {new Date(apt.scheduledAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                        {' · '}{apt.duration} {td('minutes')}
                      </p>
                      {apt.reason && <p className="text-slate-500 text-xs mt-1">{td('reason_label')}: {apt.reason}</p>}
                      {apt.fee && (
                        <p className="text-emerald-400 text-xs mt-1">
                          {td('fee_label')}: {apt.fee} {t('common.sar')} {apt.isPaid ? '✅' : '⏳'}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <VideoJoinButton
                        videoJoinPath={apt.videoJoinPath}
                        canJoinVideo={apt.canJoinVideo}
                        compact
                      />
                      {apt.status === 'PENDING' && (
                        <button onClick={() => confirmAppointment(apt.id)}
                          className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/30 transition-all">
                          {td('confirm_action')}
                        </button>
                      )}
                      {apt.status === 'CONFIRMED' && (
                        <button onClick={() => completeAppointment(apt.id)}
                          className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-all">
                          {td('complete_action')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">{td('recent_completed')}</h2>
            <div className="space-y-2">
              {completed.slice(0, 5).map(apt => (
                <div key={apt.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    {apt.clientName && <p className="text-slate-300 text-sm">{apt.clientName}</p>}
                    <p className="text-slate-500 text-xs mt-0.5">
                      {new Date(apt.scheduledAt).toLocaleDateString(dateLocale)}
                    </p>
                  </div>
                  <span className="text-xs text-emerald-400">✅ {t('appointment.status.COMPLETED')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {appointments.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-slate-400">{t('appointment.no_appointments')}</p>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
