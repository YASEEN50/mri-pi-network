'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { useAppointments, type Appointment } from '@/hooks/useAppointments'
import { useAppLocale } from '@/hooks/useAppLocale'

interface FacilityDoctor {
  doctorId: string
  doctor: { firstName: string; lastName: string; specialization: string }
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  CONFIRMED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
  NO_SHOW:   'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

const FILTERS = ['all', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const

export default function FacilityAppointmentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const tf = useTranslations('dashboard.facility')
  const ta = useTranslations('appointment')
  const td = useTranslations('dashboard')
  const { dateLocale } = useAppLocale()

  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [doctorFilter, setDoctorFilter] = useState('')
  const [doctors, setDoctors] = useState<FacilityDoctor[]>([])

  const {
    appointments,
    total,
    isLoading,
    confirmAppointment,
    completeAppointment,
    cancelAppointment,
    noShowAppointment,
    refetch,
  } = useAppointments({
    limit: 50,
    ...(activeFilter !== 'all' ? { status: activeFilter } : {}),
    ...(doctorFilter ? { doctorId: doctorFilter } : {}),
  })

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && session.user.role !== 'FACILITY') { router.push('/unauthorized'); return }
    fetch('/api/facility/doctors')
      .then((r) => r.json())
      .then((d) => setDoctors(d.data ?? []))
      .catch(() => {})
  }, [session, status, router])

  const pending = appointments.filter((a) => a.status === 'PENDING')
  const upcoming = appointments.filter((a) => a.status === 'CONFIRMED')

  const filterLabel = (key: string) =>
    key === 'all' ? tf('appointments_filter_all') : ta(`status.${key}` as 'status.PENDING')

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <Link href="/dashboard/facility/overview" className="text-slate-400 hover:text-white text-sm">
              ← {tf('overview_title')}
            </Link>
            <h1 className="text-2xl font-bold text-white mt-2">{tf('appointments_title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{tf('appointments_subtitle', { count: total })}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <p className="text-2xl font-bold text-amber-400">{pending.length}</p>
            <p className="text-slate-400 text-xs mt-1">{ta('status.PENDING')}</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-2xl font-bold text-blue-400">{upcoming.length}</p>
            <p className="text-slate-400 text-xs mt-1">{ta('status.CONFIRMED')}</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-2xl font-bold text-emerald-400">
              {appointments.filter((a) => a.status === 'COMPLETED').length}
            </p>
            <p className="text-slate-400 text-xs mt-1">{ta('status.COMPLETED')}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
          >
            <option value="" className="bg-slate-900">{tf('appointments_all_doctors')}</option>
            {doctors.map((d) => (
              <option key={d.doctorId} value={d.doctorId} className="bg-slate-900">
                د. {d.doctor.firstName} {d.doctor.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeFilter === f
                  ? 'bg-teal-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
              }`}
            >
              {filterLabel(f)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-16 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-slate-400">{tf('appointments_empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt) => (
              <FacilityAppointmentCard
                key={apt.id}
                apt={apt}
                dateLocale={dateLocale}
                tf={tf}
                ta={ta}
                td={td}
                onConfirm={apt.status === 'PENDING' ? () => void confirmAppointment(apt.id) : undefined}
                onComplete={apt.status === 'CONFIRMED' ? () => {
                  const notes = prompt(tf('appointments_notes_prompt'))
                  void completeAppointment(apt.id, notes ?? undefined)
                } : undefined}
                onNoShow={apt.status === 'CONFIRMED' ? () => void noShowAppointment(apt.id) : undefined}
                onCancel={['PENDING', 'CONFIRMED'].includes(apt.status) ? () => {
                  const reason = prompt(tf('appointments_cancel_reason')) ?? tf('appointments_cancel_default')
                  void cancelAppointment(apt.id, reason)
                } : undefined}
              />
            ))}
          </div>
        )}

        {!isLoading && appointments.length > 0 && (
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-6 text-slate-400 hover:text-white text-sm"
          >
            {tf('appointments_refresh')}
          </button>
        )}
      </div>
    </DashboardShell>
  )
}

function FacilityAppointmentCard({
  apt,
  dateLocale,
  tf,
  ta,
  td,
  onConfirm,
  onComplete,
  onNoShow,
  onCancel,
}: {
  apt: Appointment
  dateLocale: string
  tf: (key: string, values?: Record<string, string | number>) => string
  ta: (key: string) => string
  td: (key: string, values?: Record<string, string | number>) => string
  onConfirm?: () => void
  onComplete?: () => void
  onNoShow?: () => void
  onCancel?: () => void
}) {
  const date = new Date(apt.scheduledAt)

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[apt.status]}`}>
              {ta(`status.${apt.status}` as 'status.PENDING')}
            </span>
            <span className="text-xs text-slate-500">
              {apt.type === 'ONLINE' ? `💻 ${ta('online')}` : `🏥 ${ta('in_person')}`}
            </span>
          </div>

          {apt.doctor && <p className="text-white font-semibold text-sm">{apt.doctor}</p>}
          {apt.doctorDetails?.specialization && (
            <p className="text-emerald-400 text-xs mb-1">{apt.doctorDetails.specialization}</p>
          )}
          {!apt.doctor && apt.facility && (
            <p className="text-white font-semibold text-sm">{apt.facility}</p>
          )}

          {apt.clientName && (
            <p className="text-slate-400 text-xs mt-1">{tf('appointments_client')}: {apt.clientName}</p>
          )}

          <p className="text-slate-300 text-sm mt-2">
            {date.toLocaleDateString(dateLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            {date.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })} · {apt.duration} {td('minutes')}
          </p>

          {apt.reason && <p className="text-slate-500 text-xs mt-1">{td('reason_label')}: {apt.reason}</p>}
          {apt.cancelReason && (
            <p className="text-red-400/70 text-xs mt-1">{td('cancel_reason_label')}: {apt.cancelReason}</p>
          )}
          {apt.fee != null && (
            <p className="text-teal-400 text-xs mt-1">
              {td('fee_label')}: {apt.fee} π · {apt.isPaid ? td('paid') : td('unpaid')}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          {onConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-lg text-xs"
            >
              {tf('appointments_confirm')}
            </button>
          )}
          {onComplete && (
            <button
              type="button"
              onClick={onComplete}
              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs"
            >
              {tf('appointments_complete')}
            </button>
          )}
          {onNoShow && (
            <button
              type="button"
              onClick={onNoShow}
              className="px-3 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/20 text-slate-400 rounded-lg text-xs"
            >
              {tf('appointments_no_show')}
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs"
            >
              {ta('cancel')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
