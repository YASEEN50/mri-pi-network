'use client'
// src/app/dashboard/client/appointments/page.tsx
import { useTranslations } from 'next-intl'
import { useAppointments } from '@/hooks/useAppointments'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { useAppLocale } from '@/hooks/useAppLocale'
import Link from 'next/link'
import PaymentForm from '@/components/payments/PaymentForm'
import { appointmentRatingPath, isReviewPending } from '@/lib/reviews/paths'

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  CONFIRMED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
  NO_SHOW:   'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

export default function ClientAppointmentsPage() {
  const t = useTranslations()
  const td = useTranslations('dashboard')
  const tc = useTranslations('dashboard.client')
  const tn = useTranslations('dashboard.nav')
  const { dateLocale } = useAppLocale()
  const { appointments, total, isLoading, cancelAppointment, refetch } = useAppointments()

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  const upcoming  = appointments.filter(a => ['PENDING','CONFIRMED'].includes(a.status))
  const completed = appointments.filter(a => a.status === 'COMPLETED')
  const cancelled = appointments.filter(a => ['CANCELLED','NO_SHOW'].includes(a.status))
  const pendingReviews = completed.filter(a => isReviewPending(a))
  const reviewPlural = pendingReviews.length > 1
    ? (dateLocale === 'ar-SA' ? 'ات' : 's')
    : ''

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">{tc('title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{td('total_appointments', { count: total })}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/client/medical-records"
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs transition-all">
              {tn('medical_records')}
            </Link>
            <Link href="/dashboard/client/chat"
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs transition-all">
              {tn('chat')}
            </Link>
            <Link href="/doctors"
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-sm font-medium rounded-xl transition-all">
              {tn('book_new')}
            </Link>
          </div>
        </div>

        {pendingReviews.length > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-amber-300 font-medium text-sm">
                {tc('pending_review_banner', { count: pendingReviews.length, plural: reviewPlural })}
              </p>
              <p className="text-slate-400 text-xs mt-1">{tc('pending_review_hint')}</p>
            </div>
            <Link
              href={appointmentRatingPath(pendingReviews[0].id)}
              className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 rounded-xl text-sm font-medium text-center transition-all"
            >
              {td('rate_now')}
            </Link>
          </div>
        )}

        {appointments.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-slate-400 mb-4">{t('appointment.no_appointments')}</p>
            <Link href="/doctors"
              className="inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-medium transition-all">
              {tn('find_doctor')}
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                  {td('upcoming_section')} ({upcoming.length})
                </h2>
                <div className="space-y-3">
                  {upcoming.map(apt => (
                    <AppointmentCard
                      key={apt.id}
                      apt={apt}
                      dateLocale={dateLocale}
                      onRefresh={refetch}
                      onCancel={async () => {
                        const reason = prompt(td('cancel_reason_prompt')) ?? td('client_cancel_default')
                        await cancelAppointment(apt.id, reason)
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {completed.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                  {td('completed_section')} ({completed.length})
                </h2>
                <div className="space-y-3">
                  {completed.map(apt => (
                    <AppointmentCard key={apt.id} apt={apt} dateLocale={dateLocale} onRefresh={refetch} showReview />
                  ))}
                </div>
              </section>
            )}

            {cancelled.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-slate-500 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                  {td('cancelled_section')} ({cancelled.length})
                </h2>
                <div className="space-y-3 opacity-60">
                  {cancelled.slice(0,3).map(apt => (
                    <AppointmentCard key={apt.id} apt={apt} dateLocale={dateLocale} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}

function AppointmentCard({
  apt, onCancel, showReview, onRefresh, dateLocale,
}: {
  apt: any
  onCancel?: () => void
  showReview?: boolean
  onRefresh?: () => void
  dateLocale: string
}) {
  const t = useTranslations()
  const td = useTranslations('dashboard')
  const date = new Date(apt.scheduledAt)

  const paymentStatus = apt.isPaid
    ? td('paid')
    : apt.isDepositPaid
      ? td('deposit_paid')
      : td('unpaid')

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[apt.status]}`}>
              {t(`appointment.status.${apt.status}` as 'appointment.status.PENDING')}
            </span>
            <span className="text-xs text-slate-500">
              {apt.type === 'ONLINE' ? `💻 ${t('appointment.online')}` : `🏥 ${t('appointment.in_person')}`}
            </span>
          </div>

          {apt.doctor && (
            <p className="text-white font-semibold text-sm mb-1">{apt.doctor}</p>
          )}
          {apt.doctorDetails?.specialization && (
            <p className="text-slate-400 text-xs mb-1">{apt.doctorDetails.specialization}</p>
          )}
          {apt.facility && (
            <p className="text-white font-semibold text-sm mb-1">{apt.facility}</p>
          )}

          <p className="text-slate-300 text-sm">
            {date.toLocaleDateString(dateLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            {date.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })} · {apt.duration} {td('minutes')}
          </p>

          {apt.reason && (
            <p className="text-slate-500 text-xs mt-1">{td('reason_label')}: {apt.reason}</p>
          )}
          {apt.cancelReason && (
            <p className="text-red-400/70 text-xs mt-1">{td('cancel_reason_label')}: {apt.cancelReason}</p>
          )}

          {apt.fee && (
            <p className="text-emerald-400 text-xs mt-1">
              {td('fee_label')}: {apt.fee} π {apt.isPaid ? '✅' : apt.isDepositPaid ? '⏳' : '⏳'} {paymentStatus}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          {!apt.isPaid && apt.fee && ['PENDING', 'CONFIRMED'].includes(apt.status) && (
            <PaymentForm
              variant="compact"
              appointmentId={apt.id}
              fee={Number(apt.fee)}
              paymentPolicy={apt.paymentPolicy ?? 'PAY_ON_SERVICE'}
              depositPercentage={apt.depositPercentage ?? 30}
              isDepositPaid={apt.isDepositPaid}
              depositAmount={apt.depositAmount}
              isPaid={apt.isPaid}
              onSuccess={onRefresh}
            />
          )}
          {onCancel && ['PENDING','CONFIRMED'].includes(apt.status) && (
            <button onClick={onCancel}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs transition-all">
              {t('appointment.cancel')}
            </button>
          )}
          {showReview && isReviewPending(apt) && (
            <Link href={appointmentRatingPath(apt.id)}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-lg text-xs transition-all text-center">
              ⭐ {td('rate')}
            </Link>
          )}
          {apt.hasReview && (
            <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs text-center">
              ✅ {td('reviewed')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
