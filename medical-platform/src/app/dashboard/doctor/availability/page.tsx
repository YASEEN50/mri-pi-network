'use client'
import { useState } from 'react'
import Navbar from '@/components/common/Navbar'

const DAYS = [
  { key: 'SUNDAY', label: 'الأحد' },{ key: 'MONDAY', label: 'الاثنين' },
  { key: 'TUESDAY', label: 'الثلاثاء' },{ key: 'WEDNESDAY', label: 'الأربعاء' },
  { key: 'THURSDAY', label: 'الخميس' },{ key: 'FRIDAY', label: 'الجمعة' },
  { key: 'SATURDAY', label: 'السبت' },
]

export default function DoctorAvailabilityPage() {
  const [slots, setSlots] = useState(DAYS.map((d) => ({
    day: d.key,
    enabled: ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY'].includes(d.key),
    startTime: '09:00', endTime: '17:00', slotMinutes: 30,
  })))
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const toggle = (day: string) => setSlots((p) => p.map((s) => s.day === day ? { ...s, enabled: !s.enabled } : s))
  const update = (day: string, field: string, value: any) => setSlots((p) => p.map((s) => s.day === day ? { ...s, [field]: value } : s))

  async function handleSave() {
    setIsSaving(true)
    await new Promise((r) => setTimeout(r, 800))
    setIsSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar locale="ar" />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">أوقات العمل</h1>
          <p className="text-slate-400 text-sm mt-1">حدد الأيام والأوقات المتاحة لحجز المواعيد</p>
        </div>
        <div className="space-y-3">
          {DAYS.map((d) => {
            const slot = slots.find((s) => s.day === d.key)!
            return (
              <div key={d.key} className={`bg-white/[0.03] border rounded-2xl p-4 transition-all ${slot.enabled ? 'border-emerald-500/20' : 'border-white/[0.06] opacity-60'}`}>
                <div className="flex items-center gap-4">
                  <button onClick={() => toggle(d.key)} className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0 ${slot.enabled ? 'bg-emerald-500' : 'bg-white/10'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${slot.enabled ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                  <span className="text-white text-sm font-medium w-20">{d.label}</span>
                  {slot.enabled && (
                    <div className="flex items-center gap-2 flex-1">
                      <input type="time" value={slot.startTime} onChange={(e) => update(d.key, 'startTime', e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500/60 transition-all" />
                      <span className="text-slate-500 text-sm">—</span>
                      <input type="time" value={slot.endTime} onChange={(e) => update(d.key, 'endTime', e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500/60 transition-all" />
                      <select value={slot.slotMinutes} onChange={(e) => update(d.key, 'slotMinutes', Number(e.target.value))} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none transition-all">
                        <option value={15}>15 د</option><option value={30}>30 د</option><option value={45}>45 د</option><option value={60}>60 د</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <button onClick={handleSave} disabled={isSaving} className="w-full mt-8 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20">
          {isSaving ? 'جاري الحفظ...' : saved ? '✓ تم الحفظ' : 'حفظ أوقات العمل'}
        </button>
      </div>
    </div>
  )
}
