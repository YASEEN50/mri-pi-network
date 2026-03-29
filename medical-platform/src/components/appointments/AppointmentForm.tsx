'use client'
// src/components/appointments/AppointmentForm.tsx

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

interface AppointmentFormProps {
  doctorId?: string
  facilityId?: string
  onSuccess?: () => void
}

export default function AppointmentForm({ doctorId, facilityId, onSuccess }: AppointmentFormProps) {
  const t = useTranslations()
  const { data: session } = useSession()
  const router = useRouter()

  const [type, setType] = useState<'IN_PERSON' | 'ONLINE'>('IN_PERSON')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // حساب أقرب تاريخ مسموح (الغد)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) { router.push('/login'); return }

    setIsLoading(true)
    setError('')

    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId, facilityId, type, scheduledAt, reason, notes }),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error?.message ?? t('common.error')); return }

      onSuccess?.()
      router.push('/dashboard/client/appointments')
    } catch {
      setError(t('common.error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Type */}
      <div className="grid grid-cols-2 gap-3">
        {(['IN_PERSON', 'ONLINE'] as const).map((opt) => (
          <button key={opt} type="button" onClick={() => setType(opt)}
            className={`py-3 rounded-xl border text-sm font-medium transition-all ${
              type === opt
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
            }`}>
            {opt === 'IN_PERSON' ? `🏥 ${t('appointment.in_person')}` : `💻 ${t('appointment.online')}`}
          </button>
        ))}
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">{t('appointment.date')}</label>
          <input type="date" value={date} min={minDate} onChange={(e) => setDate(e.target.value)} required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/60 transition-all" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">{t('appointment.time')}</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/60 transition-all" />
        </div>
      </div>

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">{t('appointment.reason')}</label>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="مثال: فحص دوري، استشارة..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-all" />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">{t('appointment.notes')}</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-all resize-none" />
      </div>

      <button type="submit" disabled={isLoading || !date || !time}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20">
        {isLoading ? t('common.loading') : t('appointment.confirm')}
      </button>
    </form>
  )
}
