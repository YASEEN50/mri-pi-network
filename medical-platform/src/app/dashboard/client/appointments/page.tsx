'use client'
// src/app/dashboard/client/appointments/page.tsx

import { useTranslations } from 'next-intl'
import { useAppointments } from '@/hooks/useAppointments'
import Navbar from '@/components/common/Navbar'
import { useAuth } from '@/hooks/useAuth'

const statusColors: Record<string, string> = {
  PENDING:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  CONFIRMED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
  NO_SHOW:   'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

export default function ClientAppointmentsPage() {
  const t = useTranslations()
  const { user } = useAuth()
  const { appointments, total, isLoading, cancelAppointment } = useAppointments()

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar locale="ar" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">{t('appointment.my_appointments')}</h1>
          <p className="text-slate-400 text-sm mt-1">{total} {t('common.of')} المواعيد</p>
        </div>

        {appointments.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-slate-400">{t('appointment.no_appointments')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((apt) => (
              <div key={apt.id}
                className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${statusColors[apt.status] ?? ''}`}>
                        {t(`appointment.status.${apt.status}` as any)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {apt.type === 'ONLINE' ? '💻 عن بعد' : '🏥 حضوري'}
                      </span>
                    </div>
                    <p className="text-white font-medium">
                      {new Date(apt.scheduledAt).toLocaleDateString('ar-SA', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </p>
                    <p className="text-slate-400 text-sm mt-0.5">
                      {new Date(apt.scheduledAt).toLocaleTimeString('ar-SA', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                      {' · '}{apt.duration} دقيقة
                    </p>
                    {apt.reason && (
                      <p className="text-slate-500 text-xs mt-2">السبب: {apt.reason}</p>
                    )}
                  </div>

                  <div className="text-end">
                    {apt.fee && (
                      <p className="text-emerald-400 font-bold text-sm">{apt.fee} ر.س</p>
                    )}
                    {(apt.status === 'PENDING' || apt.status === 'CONFIRMED') && (
                      <button
                        onClick={() => cancelAppointment(apt.id, 'إلغاء من العميل')}
                        className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors">
                        إلغاء الموعد
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
