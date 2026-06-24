'use client'
// src/app/dashboard/client/appointments/page.tsx
import { useAppointments } from '@/hooks/useAppointments'
import Navbar from '@/components/common/Navbar'
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

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد الانتظار', CONFIRMED: 'مؤكد',
  COMPLETED: 'مكتمل', CANCELLED: 'ملغي', NO_SHOW: 'لم يحضر',
}

export default function ClientAppointmentsPage() {
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

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">مواعيدي</h1>
            <p className="text-slate-400 text-sm mt-1">{total} موعد إجمالاً</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/client/medical-records"
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs transition-all">
              📋 سجلي الطبي
            </Link>
            <Link href="/dashboard/client/chat"
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs transition-all">
              💬 المحادثات
            </Link>
            <Link href="/doctors"
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-sm font-medium rounded-xl transition-all">
              + حجز موعد جديد
            </Link>
          </div>
        </div>

        {pendingReviews.length > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-amber-300 font-medium text-sm">
                ⭐ {pendingReviews.length} موعد{pendingReviews.length > 1 ? 'ات' : ''} بانتظار تقييمك
              </p>
              <p className="text-slate-400 text-xs mt-1">ساعد المرضى الآخرين بمشاركة تجربتك</p>
            </div>
            <Link
              href={appointmentRatingPath(pendingReviews[0].id)}
              className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 rounded-xl text-sm font-medium text-center transition-all"
            >
              قيّم الآن
            </Link>
          </div>
        )}

        {appointments.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-slate-400 mb-4">لا توجد مواعيد بعد</p>
            <Link href="/doctors"
              className="inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-medium transition-all">
              ابحث عن طبيب
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* المواعيد القادمة */}
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                  المواعيد القادمة ({upcoming.length})
                </h2>
                <div className="space-y-3">
                  {upcoming.map(apt => (
                    <AppointmentCard
                      key={apt.id}
                      apt={apt}
                      onRefresh={refetch}
                      onCancel={async () => {
                        const reason = prompt('سبب الإلغاء:') ?? 'إلغاء من العميل'
                        await cancelAppointment(apt.id, reason)
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* المواعيد المكتملة */}
            {completed.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                  المواعيد المكتملة ({completed.length})
                </h2>
                <div className="space-y-3">
                  {completed.map(apt => (
                    <AppointmentCard key={apt.id} apt={apt} onRefresh={refetch} showReview />
                  ))}
                </div>
              </section>
            )}

            {/* الملغاة */}
            {cancelled.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-slate-500 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                  مواعيد ملغاة ({cancelled.length})
                </h2>
                <div className="space-y-3 opacity-60">
                  {cancelled.slice(0,3).map(apt => (
                    <AppointmentCard key={apt.id} apt={apt} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AppointmentCard({
  apt, onCancel, showReview, onRefresh,
}: {
  apt: any
  onCancel?: () => void
  showReview?: boolean
  onRefresh?: () => void
}) {
  const date = new Date(apt.scheduledAt)
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[apt.status]}`}>
              {STATUS_LABELS[apt.status]}
            </span>
            <span className="text-xs text-slate-500">
              {apt.type === 'ONLINE' ? '💻 عن بعد' : '🏥 حضوري'}
            </span>
          </div>

          {/* اسم الطبيب أو المنشأة */}
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
            {date.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            {date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })} · {apt.duration} دقيقة
          </p>

          {apt.reason && (
            <p className="text-slate-500 text-xs mt-1">السبب: {apt.reason}</p>
          )}
          {apt.cancelReason && (
            <p className="text-red-400/70 text-xs mt-1">سبب الإلغاء: {apt.cancelReason}</p>
          )}

          {apt.fee && (
            <p className="text-emerald-400 text-xs mt-1">
              الرسوم: {apt.fee} π {apt.isPaid ? '✅ مدفوع' : apt.isDepositPaid ? '⏳ إيداع مدفوع' : '⏳ غير مدفوع'}
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
              إلغاء
            </button>
          )}
          {showReview && isReviewPending(apt) && (
            <Link href={appointmentRatingPath(apt.id)}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-lg text-xs transition-all text-center">
              ⭐ تقييم
            </Link>
          )}
          {apt.hasReview && (
            <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs text-center">
              ✅ قيّمت
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
