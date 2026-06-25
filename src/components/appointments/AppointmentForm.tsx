'use client'
// src/components/appointments/AppointmentForm.tsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import DepositCalculator from '@/components/payments/DepositCalculator'
import { payForAppointment, piPaymentErrorMessage } from '@/lib/pi/pi-payment-client'
import {
  resolveAppointmentPayment,
  type AppointmentPaymentPolicy,
} from '@/lib/payment/appointment-payment'

const ONLINE_ENABLED = process.env.NEXT_PUBLIC_ONLINE_APPOINTMENTS_ENABLED !== 'false'

interface BookableSlot {
  scheduledAt: string
  timeLabel: string
  duration: number
}

interface AppointmentFormProps {
  doctorId?: string
  facilityId?: string
  consultationFee?: number | null
  paymentPolicy?: AppointmentPaymentPolicy
  depositPercentage?: number
  onSuccess?: () => void
}

export default function AppointmentForm({
  doctorId,
  facilityId,
  consultationFee = null,
  paymentPolicy = 'PAY_ON_SERVICE',
  depositPercentage = 30,
  onSuccess,
}: AppointmentFormProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const t = useTranslations('appointment')
  const tv = useTranslations('appointment.video')

  const [type, setType] = useState<'IN_PERSON' | 'ONLINE'>('IN_PERSON')
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<BookableSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<BookableSlot | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [paymentPending, setPaymentPending] = useState(false)

  const fee = consultationFee ?? 0

  const paymentQuote = useMemo(
    () =>
      resolveAppointmentPayment({
        fee,
        paymentPolicy,
        depositPercentage,
        isDepositPaid: false,
        isPaid: false,
      }),
    [fee, paymentPolicy, depositPercentage],
  )

  const requiresUpfrontPayment = paymentQuote.requiresPayment && fee > 0 && !!doctorId

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  const slotsUrl = doctorId
    ? `/api/doctors/${doctorId}/slots`
    : facilityId
      ? `/api/facilities/${facilityId}/slots`
      : null

  const fetchSlots = useCallback(async (selectedDate: string) => {
    if (!slotsUrl || !selectedDate) return
    setSlotsLoading(true)
    setSelectedSlot(null)
    try {
      const res = await fetch(`${slotsUrl}?date=${selectedDate}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.data?.error) {
        setSlots([])
        setError(data.data.message ?? 'لا توجد أوقات متاحة')
        return
      }
      setError('')
      setSlots(data.data ?? [])
    } catch {
      setSlots([])
      setError('تعذّر تحميل الأوقات المتاحة')
    } finally {
      setSlotsLoading(false)
    }
  }, [slotsUrl])

  useEffect(() => {
    if (date) void fetchSlots(date)
    else {
      setSlots([])
      setSelectedSlot(null)
    }
  }, [date, fetchSlots])

  async function handleBook() {
    if (!session) {
      router.push('/login')
      return
    }
    if (!selectedSlot) {
      setError('يرجى اختيار وقت متاح')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId,
          facilityId,
          type,
          scheduledAt: selectedSlot.scheduledAt,
          duration: selectedSlot.duration,
          reason: reason || undefined,
          notes: notes || undefined,
          fee: fee > 0 ? fee : undefined,
        }),
      })

      const data = await res.json()

      if (data.data?.error) {
        setError(data.data.message ?? 'حدث خطأ')
        return
      }

      if (!res.ok) {
        setError(data.error?.message ?? 'حدث خطأ في الحجز')
        return
      }

      const appointmentId = data.data?.id as string | undefined

      if (requiresUpfrontPayment && appointmentId) {
        setPaymentPending(true)
        try {
          await payForAppointment({
            appointmentId,
            fee,
            paymentPolicy,
            depositPercentage,
            isDepositPaid: false,
            isPaid: false,
          })
        } catch (payErr) {
          setError(
            `${piPaymentErrorMessage(payErr)} — تم إنشاء الموعد. يمكنك إتمام الدفع من صفحة مواعيدك.`,
          )
          setTimeout(() => router.push('/dashboard/client/appointments'), 2500)
          return
        } finally {
          setPaymentPending(false)
        }
      }

      setSuccess(true)
      onSuccess?.()
      setTimeout(() => router.push('/dashboard/client/appointments'), 1500)
    } catch {
      setError('حدث خطأ في الاتصال')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-2">✅</div>
        <p className="text-emerald-400 font-medium">
          {requiresUpfrontPayment ? 'تم الحجز والدفع بنجاح!' : 'تم إرسال طلب الحجز!'}
        </p>
        <p className="text-slate-400 text-sm mt-1">سيصلك إشعار عند تأكيد الطبيب — جاري التوجيه...</p>
      </div>
    )
  }

  const submitLabel = (() => {
    if (isLoading || paymentPending) return paymentPending ? 'جاري الدفع عبر Pi...' : 'جاري الحجز...'
    if (requiresUpfrontPayment) {
      return `📅 حجز ودفع ${paymentQuote.amount.toFixed(4)} π`
    }
    return '📅 طلب حجز موعد'
  })()

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {fee > 0 && doctorId && (
        <DepositCalculator
          fee={fee}
          paymentPolicy={paymentPolicy}
          depositPercentage={depositPercentage}
        />
      )}

      {requiresUpfrontPayment && (
        <p className="text-purple-300/90 text-xs bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2">
          🟣 الدفع بعملة Pi مطلوب الآن عبر Pi Browser — {paymentQuote.amount.toFixed(4)} π
        </p>
      )}

      {(() => {
        const typeOptions: Array<'IN_PERSON' | 'ONLINE'> = ONLINE_ENABLED
          ? ['IN_PERSON', 'ONLINE']
          : ['IN_PERSON']
        return (
      <div className={`grid gap-2 ${ONLINE_ENABLED ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {typeOptions.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => setType(opt)}
            className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
              type === opt
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
            }`}
          >
            {opt === 'IN_PERSON' ? `🏥 ${t('in_person')}` : `💻 ${t('online')}`}
          </button>
        ))}
      </div>
        )
      })()}

      {type === 'ONLINE' && ONLINE_ENABLED && (
        <p className="text-sky-400/80 text-xs">{tv('booking_hint')}</p>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">التاريخ</label>
        <input
          type="date"
          value={date}
          min={minDate}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/60 transition-all"
        />
      </div>

      {date && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">الوقت المتاح</label>
          {slotsLoading ? (
            <p className="text-slate-500 text-sm py-2">جاري تحميل الأوقات...</p>
          ) : slots.length === 0 ? (
            <p className="text-slate-500 text-sm py-2">لا توجد أوقات متاحة في هذا اليوم</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
              {slots.map(slot => (
                <button
                  key={slot.scheduledAt}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                    selectedSlot?.scheduledAt === slot.scheduledAt
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                  }`}
                >
                  {slot.timeLabel}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">سبب الزيارة</label>
        <input
          type="text"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="مثال: فحص دوري، استشارة..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">ملاحظات (اختياري)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-all resize-none"
        />
      </div>

      <button
        type="button"
        onClick={() => void handleBook()}
        disabled={isLoading || paymentPending || !selectedSlot}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all"
      >
        {submitLabel}
      </button>

      {!session && (
        <p className="text-center text-slate-500 text-xs">
          يجب{' '}
          <a href="/login" className="text-emerald-400 hover:underline">
            تسجيل الدخول
          </a>{' '}
          للحجز
        </p>
      )}
    </div>
  )
}
