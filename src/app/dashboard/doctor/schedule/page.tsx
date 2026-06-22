'use client'
// src/app/dashboard/doctor/schedule/page.tsx
import { useTranslations } from 'next-intl'
import { useAppointments } from '@/hooks/useAppointments'
import Navbar from '@/components/common/Navbar'
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
  const { data: session } = useSession()
  const { appointments, total, isLoading, confirmAppointment, completeAppointment } = useAppointments()

  const profileApproved = session?.user?.approvalStatus === 'APPROVED'
  const [verifState, setVerifState] = useState<string | null>(null)
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

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  const upcoming  = appointments.filter(a => ['PENDING','CONFIRMED'].includes(a.status))
  const completed = appointments.filter(a => a.status === 'COMPLETED')

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      {/* Verification Banner */}
      {verifState && !['APPROVED'].includes(verifState) && !profileApproved && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <Link href="/profile">
            <div className="flex items-center justify-between rounded-xl px-4 py-3 transition-all hover:opacity-90"
              style={{
                background: verifState === 'ADMIN_REVIEW' || verifState === 'PENDING_HUMAN'
                  ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${verifState === 'ADMIN_REVIEW' || verifState === 'PENDING_HUMAN' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
              <div className="flex items-center gap-2">
                <span>{verifState === 'ADMIN_REVIEW' || verifState === 'PENDING_HUMAN' ? '⏳' : '⚠️'}</span>
                <span className="text-sm font-medium" style={{
                  color: verifState === 'ADMIN_REVIEW' || verifState === 'PENDING_HUMAN' ? '#fbbf24' : '#f87171'
                }}>
                  {verifState === 'ADMIN_REVIEW' || verifState === 'PENDING_HUMAN'
                    ? 'طلب التحقق قيد المراجعة — لا يمكن استقبال مرضى حتى الموافقة'
                    : 'حسابك غير موثق — اضغط هنا لإكمال التحقق من هويتك الطبية'}
                </span>
              </div>
              <span className="text-slate-400 text-xs">← اضغط للتحقق</span>
            </div>
          </Link>
        </div>
      )}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">جدول المواعيد</h1>
            <p className="text-slate-400 text-sm mt-1">{total} موعد إجمالاً</p>
          </div>
          <div className="flex gap-3 text-sm">
            <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              {upcoming.length} قادم
            </div>
            <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              {completed.length} مكتمل
            </div>
          </div>
        </div>

        {/* روابط سريعة */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <Link href="/dashboard/doctor/availability"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            ⏰ أوقات العمل
          </Link>
          <Link href="/dashboard/doctor/payment-settings"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            💳 إعدادات الدفع
          </Link>
          <Link href="/dashboard/doctor/analytics"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            📊 الإحصائيات
          </Link>
          <Link href="/dashboard/doctor/publications"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            ✍️ المنشورات
          </Link>
          <Link href="/dashboard/doctor/chat"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            💬 المحادثات
          </Link>
          <Link href="/profile"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            🔐 التحقق
          </Link>
        </div>

        {/* المواعيد القادمة */}
        {upcoming.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">المواعيد القادمة</h2>
            <div className="space-y-3">
              {upcoming.map(apt => (
                <div key={apt.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[apt.status]}`}>
                          {apt.status === 'PENDING' ? 'قيد الانتظار' : 'مؤكد'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {apt.type === 'ONLINE' ? '💻' : '🏥'}
                        </span>
                      </div>
                      {/* اسم المريض */}
                      {apt.clientName && (
                        <p className="text-white font-medium text-sm mb-1">
                          المريض: {apt.clientName}
                        </p>
                      )}
                      <p className="text-slate-300 text-sm">
                        {new Date(apt.scheduledAt).toLocaleDateString('ar-SA', {
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {new Date(apt.scheduledAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}{apt.duration} دقيقة
                      </p>
                      {apt.reason && <p className="text-slate-500 text-xs mt-1">السبب: {apt.reason}</p>}
                      {apt.fee && (
                        <p className="text-emerald-400 text-xs mt-1">
                          الرسوم: {apt.fee} ر.س {apt.isPaid ? '✅' : '⏳'}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {apt.status === 'PENDING' && (
                        <button onClick={() => confirmAppointment(apt.id)}
                          className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/30 transition-all">
                          تأكيد ✓
                        </button>
                      )}
                      {apt.status === 'CONFIRMED' && (
                        <button onClick={() => completeAppointment(apt.id)}
                          className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-all">
                          إتمام ✓
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* المكتملة */}
        {completed.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">آخر المواعيد المكتملة</h2>
            <div className="space-y-2">
              {completed.slice(0, 5).map(apt => (
                <div key={apt.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    {apt.clientName && <p className="text-slate-300 text-sm">{apt.clientName}</p>}
                    <p className="text-slate-500 text-xs mt-0.5">
                      {new Date(apt.scheduledAt).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                  <span className="text-xs text-emerald-400">✅ مكتمل</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {appointments.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-slate-400">لا توجد مواعيد بعد</p>
          </div>
        )}
      </div>
    </div>
  )
}
