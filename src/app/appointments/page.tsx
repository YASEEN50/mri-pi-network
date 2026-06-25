'use client'
// src/app/appointments/page.tsx

import { useAppointments } from '@/hooks/useAppointments'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'

const statusColors: Record<string, string> = {
  PENDING:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  CONFIRMED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
  NO_SHOW:   'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

const statusLabels: Record<string, string> = {
  PENDING: 'قيد الانتظار', CONFIRMED: 'مؤكد',
  COMPLETED: 'مكتمل', CANCELLED: 'ملغي', NO_SHOW: 'لم يحضر',
}

export default function AppointmentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState('all')

  const { appointments, total, isLoading, cancelAppointment } =
    useAppointments(activeFilter !== 'all' ? { status: activeFilter } : {})

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const filters = [
    { key: 'all', label: 'الكل' },
    { key: 'PENDING', label: 'معلق' },
    { key: 'CONFIRMED', label: 'مؤكد' },
    { key: 'COMPLETED', label: 'مكتمل' },
    { key: 'CANCELLED', label: 'ملغي' },
  ]

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">مواعيدي</h1>
            <p className="text-slate-400 text-sm mt-1">{total} موعد إجمالاً</p>
          </div>
          <Link href="/doctors"
            className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-medium transition-all">
            + حجز موعد جديد
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeFilter === f.key
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-slate-400 mb-4">لا توجد مواعيد</p>
            <Link href="/doctors"
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-medium transition-all">
              احجز موعدك الأول
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((apt) => (
              <div key={apt.id}
                className="bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12] rounded-2xl p-5 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${statusColors[apt.status]}`}>
                        {statusLabels[apt.status]}
                      </span>
                      <span className="text-xs text-slate-500">
                        {apt.type === 'ONLINE' ? '💻 عن بعد' : '🏥 حضوري'}
                      </span>
                    </div>

                    <p className="text-white font-semibold">
                      {new Date(apt.scheduledAt).toLocaleDateString('ar-SA', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </p>
                    <p className="text-slate-400 text-sm mt-0.5">
                      {new Date(apt.scheduledAt).toLocaleTimeString('ar-SA', {
                        hour: '2-digit', minute: '2-digit',
                      })} · {apt.duration} دقيقة
                    </p>
                    {apt.reason && (
                      <p className="text-slate-500 text-xs mt-2">السبب: {apt.reason}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    {apt.fee && (
                      <p className="text-emerald-400 font-bold text-sm">{apt.fee} π</p>
                    )}

                    {apt.status === 'COMPLETED' && (
                      <Link href={`/appointments/${apt.id}/rating`}
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-xl text-xs transition-all">
                        ⭐ تقييم
                      </Link>
                    )}

                    {(apt.status === 'PENDING' || apt.status === 'CONFIRMED') && (
                      <button onClick={() => {
                        if (confirm('هل تريد إلغاء هذا الموعد؟')) {
                          cancelAppointment(apt.id, 'إلغاء من العميل')
                        }
                      }}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs transition-all">
                        إلغاء
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
