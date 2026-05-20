'use client'
// src/components/appointments/AppointmentForm.tsx
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

interface AppointmentFormProps {
  doctorId?:   string
  facilityId?: string
  onSuccess?:  () => void
}

export default function AppointmentForm({ doctorId, facilityId, onSuccess }: AppointmentFormProps) {
  const t = useTranslations()
  const { data: session } = useSession()
  const router = useRouter()

  const [type,      setType]      = useState<'IN_PERSON' | 'ONLINE'>('IN_PERSON')
  const [date,      setDate]      = useState('')
  const [time,      setTime]      = useState('')
  const [reason,    setReason]    = useState('')
  const [notes,     setNotes]     = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState(false)

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  async function handleBook() {
    if (!session) { router.push('/login'); return }
    if (!date || !time) { setError('يرجى تحديد التاريخ والوقت'); return }

    setIsLoading(true)
    setError('')

    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
      const res = await fetch('/api/appointments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          doctorId, facilityId, type, scheduledAt,
          duration: 30,
          reason:   reason || undefined,
          notes:    notes  || undefined,
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

  if (success) return (
    <div className="text-center py-6">
      <div className="text-4xl mb-2">✅</div>
      <p className="text-emerald-400 font-medium">تم الحجز بنجاح!</p>
      <p className="text-slate-400 text-sm mt-1">جاري التوجيه...</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* نوع الموعد */}
      <div className="grid grid-cols-2 gap-2">
        {(['IN_PERSON', 'ONLINE'] as const).map(opt => (
          <button key={opt} type="button" onClick={() => setType(opt)}
            className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
              type === opt
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
            }`}>
            {opt === 'IN_PERSON' ? '🏥 حضوري' : '💻 عن بعد'}
          </button>
        ))}
      </div>

      {/* التاريخ */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">التاريخ</label>
        <input type="date" value={date} min={minDate}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/60 transition-all" />
      </div>

      {/* الوقت */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">الوقت</label>
        <input type="time" value={time}
          onChange={e => setTime(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/60 transition-all" />
      </div>

      {/* السبب */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">سبب الزيارة</label>
        <input type="text" value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="مثال: فحص دوري، استشارة..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-all" />
      </div>

      {/* ملاحظات */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">ملاحظات (اختياري)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-all resize-none" />
      </div>

      <button
        type="button"
        onClick={handleBook}
        disabled={isLoading || !date || !time}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all">
        {isLoading ? 'جاري الحجز...' : '📅 تأكيد الحجز'}
      </button>

      {!session && (
        <p className="text-center text-slate-500 text-xs">
          يجب <a href="/login" className="text-emerald-400 hover:underline">تسجيل الدخول</a> للحجز
        </p>
      )}
    </div>
  )
}
