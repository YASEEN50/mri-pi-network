'use client'
// src/app/dashboard/doctor/availability/page.tsx
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import DoctorSubpageLayout from '@/components/doctor/DoctorSubpageLayout'

const DAY_KEYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const

const DEFAULT_SLOTS = DAY_KEYS.map(d => ({
  day:         d,
  startTime:   '09:00',
  endTime:     '17:00',
  slotMinutes: 30,
  isActive:    ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY'].includes(d),
}))

export default function DoctorAvailabilityPage() {
  const t = useTranslations()
  const td = useTranslations('dashboard')
  const tdoc = useTranslations('dashboard.doctor')
  const tdays = useTranslations('dashboard.days')
  const [slots,    setSlots]    = useState(DEFAULT_SLOTS)
  const [isLoading,setIsLoading]= useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message,  setMessage]  = useState<{ type: 'success'|'error'; text: string } | null>(null)

  useEffect(() => { fetchAvailability() }, [])

  async function fetchAvailability() {
    try {
      const res  = await fetch('/api/doctor/availability')
      const data = await res.json()
      if (data.data?.length > 0) {
        setSlots(DAY_KEYS.map(d => {
          const saved = data.data.find((s: { day: string }) => s.day === d)
          return saved
            ? { day: d, startTime: saved.startTime, endTime: saved.endTime, slotMinutes: saved.slotMinutes, isActive: saved.isActive }
            : { day: d, startTime: '09:00', endTime: '17:00', slotMinutes: 30, isActive: false }
        }))
      }
    } catch {}
    finally { setIsLoading(false) }
  }

  const toggle = (day: string) =>
    setSlots(p => p.map(s => s.day === day ? { ...s, isActive: !s.isActive } : s))

  const update = (day: string, field: string, value: string | number) =>
    setSlots(p => p.map(s => s.day === day ? { ...s, [field]: value } : s))

  async function handleSave() {
    setIsSaving(true)
    setMessage(null)
    try {
      const res  = await fetch('/api/doctor/availability', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(slots.filter(s => s.isActive)),
      })
      const data = await res.json()
      if (data.data?.error) {
        setMessage({ type: 'error', text: data.data.message })
      } else {
        setMessage({ type: 'success', text: tdoc('availability_saved') })
      }
    } catch {
      setMessage({ type: 'error', text: t('common.error') })
    } finally {
      setIsSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <DoctorSubpageLayout title={tdoc('availability_title')} subtitle={tdoc('availability_subtitle')}>
      <div className="mb-8 flex items-center justify-end">
        <div className="text-sm text-slate-400">
          {tdoc('active_days', { count: slots.filter(s => s.isActive).length })}
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {DAY_KEYS.map(d => {
          const slot = slots.find(s => s.day === d)!
          return (
            <div key={d} className={`bg-white/[0.03] border rounded-2xl p-4 transition-all
              ${slot.isActive ? 'border-emerald-500/20' : 'border-white/[0.06] opacity-60'}`}>
              <div className="flex items-center gap-4">
                <button onClick={() => toggle(d)}
                  className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0
                    ${slot.isActive ? 'bg-emerald-500' : 'bg-white/10'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all
                    ${slot.isActive ? 'right-0.5' : 'left-0.5'}`} />
                </button>

                <span className="text-white text-sm font-medium w-20">{tdays(d)}</span>

                {slot.isActive && (
                  <div className="flex items-center gap-2 flex-1 flex-wrap">
                    <input type="time" value={slot.startTime}
                      onChange={e => update(d, 'startTime', e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500/60" />
                    <span className="text-slate-500 text-xs">{tdoc('time_to')}</span>
                    <input type="time" value={slot.endTime}
                      onChange={e => update(d, 'endTime', e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500/60" />
                    <select value={slot.slotMinutes}
                      onChange={e => update(d, 'slotMinutes', Number(e.target.value))}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500/60">
                      {[15,20,30,45,60,90].map(m => (
                        <option key={m} value={m} className="bg-slate-900">{tdoc('slot_minutes', { m })}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm border
          ${message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <button onClick={handleSave} disabled={isSaving}
        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all">
        {isSaving ? t('common.loading') : tdoc('save_availability')}
      </button>
    </DoctorSubpageLayout>
  )
}
