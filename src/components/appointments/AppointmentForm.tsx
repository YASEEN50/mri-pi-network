'use client'
// src/components/appointments/AppointmentForm.tsx
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface BookableSlot {
  scheduledAt: string
  timeLabel: string
  duration: number
}

interface AppointmentFormProps {
  doctorId?: string
  facilityId?: string
  onSuccess?: () => void
}

export default function AppointmentForm({ doctorId, facilityId, onSuccess }: AppointmentFormProps) {
  const { data: session } = useSession()
  const router = useRouter()

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
        <p className="text-emerald-400 font-medium">تم إرسال طلب الحجز!</p>
        <p className="text-slate-400 text-sm mt-1">سيصلك إشعار عند تأكيد الطبيب — جاري التوجيه...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {(['IN_PERSON', 'ONLINE'] as const).map(opt => (
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
            {opt === 'IN_PERSON' ? '🏥 حضوري' : '💻 عن بعد'}
          </button>
        ))}
      </div>

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
        onClick={handleBook}
        disabled={isLoading || !selectedSlot}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all"
      >
        {isLoading ? 'جاري الحجز...' : '📅 طلب حجز موعد'}
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
