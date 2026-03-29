'use client'
import { useTranslations } from 'next-intl'
import { useAppointments } from '@/hooks/useAppointments'
import Navbar from '@/components/common/Navbar'

const statusColors: Record<string, string> = {
  PENDING:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  CONFIRMED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function DoctorSchedulePage() {
  const t = useTranslations()
  const { appointments, total, isLoading, confirmAppointment, completeAppointment } = useAppointments()
  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" /></div>
  const upcoming  = appointments.filter((a) => ['PENDING','CONFIRMED'].includes(a.status))
  const completed = appointments.filter((a) => a.status === 'COMPLETED')
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar locale="ar" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('dashboard.schedule')}</h1>
            <p className="text-slate-400 text-sm mt-1">{total} موعد إجمالاً</p>
          </div>
          <div className="flex gap-3 text-sm">
            <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">{upcoming.length} قادم</div>
            <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">{completed.length} مكتمل</div>
          </div>
        </div>
        {upcoming.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">المواعيد القادمة</h2>
            <div className="space-y-3">
              {upcoming.map((apt) => (
                <div key={apt.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${statusColors[apt.status]}`}>{t(`appointment.status.${apt.status}` as any)}</span>
                        <span className="text-xs text-slate-500">{apt.type === 'ONLINE' ? '💻' : '🏥'}</span>
                      </div>
                      <p className="text-white font-medium">{new Date(apt.scheduledAt).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      <p className="text-slate-400 text-sm mt-0.5">{new Date(apt.scheduledAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })} · {apt.duration} دقيقة</p>
                      {apt.reason && <p className="text-slate-500 text-xs mt-1">السبب: {apt.reason}</p>}
                    </div>
                    <div className="flex flex-col gap-2">
                      {apt.status === 'PENDING' && <button onClick={() => confirmAppointment(apt.id)} className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/30 transition-all">تأكيد</button>}
                      {apt.status === 'CONFIRMED' && <button onClick={() => completeAppointment(apt.id)} className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-all">إتمام</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {completed.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">المواعيد المكتملة</h2>
            <div className="space-y-3">
              {completed.slice(0,5).map((apt) => (
                <div key={apt.id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 opacity-70">
                  <p className="text-slate-300 text-sm">{new Date(apt.scheduledAt).toLocaleDateString('ar-SA')} · {apt.duration} دقيقة</p>
                  {apt.reason && <p className="text-slate-500 text-xs mt-1">{apt.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {appointments.length === 0 && <div className="text-center py-20"><div className="text-5xl mb-4">📅</div><p className="text-slate-400">{t('appointment.no_appointments')}</p></div>}
      </div>
    </div>
  )
}
