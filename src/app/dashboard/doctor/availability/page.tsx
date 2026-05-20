'use client'
// src/app/dashboard/doctor/availability/page.tsx
import { useState, useEffect } from 'react'
import Navbar from '@/components/common/Navbar'

const DAYS = [
  { key: 'SUNDAY',    label: 'الأحد' },
  { key: 'MONDAY',    label: 'الاثنين' },
  { key: 'TUESDAY',   label: 'الثلاثاء' },
  { key: 'WEDNESDAY', label: 'الأربعاء' },
  { key: 'THURSDAY',  label: 'الخميس' },
  { key: 'FRIDAY',    label: 'الجمعة' },
  { key: 'SATURDAY',  label: 'السبت' },
]

const DEFAULT_SLOTS = DAYS.map(d => ({
  day:         d.key,
  startTime:   '09:00',
  endTime:     '17:00',
  slotMinutes: 30,
  isActive:    ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY'].includes(d.key),
}))

export default function DoctorAvailabilityPage() {
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
        // دمج البيانات المحفوظة مع القائمة الكاملة
        setSlots(DAYS.map(d => {
          const saved = data.data.find((s: any) => s.day === d.key)
          return saved
            ? { day: d.key, startTime: saved.startTime, endTime: saved.endTime, slotMinutes: saved.slotMinutes, isActive: saved.isActive }
            : { day: d.key, startTime: '09:00', endTime: '17:00', slotMinutes: 30, isActive: false }
        }))
      }
    } catch {}
    finally { setIsLoading(false) }
  }

  const toggle = (day: string) =>
    setSlots(p => p.map(s => s.day === day ? { ...s, isActive: !s.isActive } : s))

  const update = (day: string, field: string, value: any) =>
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
        setMessage({ type: 'success', text: 'تم حفظ أوقات العمل بنجاح ✅' })
      }
    } catch {
      setMessage({ type: 'error', text: 'حدث خطأ في الاتصال' })
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
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">أوقات العمل</h1>
            <p className="text-slate-400 text-sm mt-1">حدد الأيام والأوقات المتاحة للحجز</p>
          </div>
          <div className="text-sm text-slate-400">
            {slots.filter(s => s.isActive).length} يوم نشط
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {DAYS.map(d => {
            const slot = slots.find(s => s.day === d.key)!
            return (
              <div key={d.key} className={`bg-white/[0.03] border rounded-2xl p-4 transition-all
                ${slot.isActive ? 'border-emerald-500/20' : 'border-white/[0.06] opacity-60'}`}>
                <div className="flex items-center gap-4">
                  {/* Toggle */}
                  <button onClick={() => toggle(d.key)}
                    className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0
                      ${slot.isActive ? 'bg-emerald-500' : 'bg-white/10'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all
                      ${slot.isActive ? 'right-0.5' : 'left-0.5'}`} />
                  </button>

                  <span className="text-white text-sm font-medium w-20">{d.label}</span>

                  {slot.isActive && (
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <input type="time" value={slot.startTime}
                        onChange={e => update(d.key, 'startTime', e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500/60" />
                      <span className="text-slate-500 text-xs">إلى</span>
                      <input type="time" value={slot.endTime}
                        onChange={e => update(d.key, 'endTime', e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500/60" />
                      <select value={slot.slotMinutes}
                        onChange={e => update(d.key, 'slotMinutes', Number(e.target.value))}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500/60">
                        {[15,20,30,45,60,90].map(m => (
                          <option key={m} value={m} className="bg-slate-900">{m} دقيقة</option>
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
          {isSaving ? 'جاري الحفظ...' : 'حفظ أوقات العمل'}
        </button>
      </div>
    </div>
  )
}
