'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ON_CALL_SHIFT_LABELS } from '@/lib/facility/department-catalog'

interface Department {
  id: string
  name: string
  icon: string | null
  isActive: boolean
}

interface DeptDoctor {
  doctorId: string
  isActive: boolean
  doctor: { firstName: string; lastName: string; specialization: string }
}

interface Shift {
  id: string
  department: { id: string; name: string; icon: string | null }
  doctor: { id: string; fullName: string; specialization: string }
  startsAt: string
  endsAt: string
  shiftType: string
  isActiveNow: boolean
  notes: string | null
}

const SHIFT_TYPES = ['MORNING', 'EVENING', 'NIGHT', 'FULL_DAY'] as const

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function FacilityOnCallPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const tf = useTranslations('dashboard.facility')
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentDoctors, setDepartmentDoctors] = useState<DeptDoctor[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [departmentId, setDepartmentId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [shiftType, setShiftType] = useState<string>('MORNING')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [notes, setNotes] = useState('')

  const loadDepartmentDoctors = useCallback(async (deptId: string) => {
    if (!deptId) {
      setDepartmentDoctors([])
      return
    }
    const res = await fetch(`/api/facility/departments/${deptId}/doctors`)
    const data = await res.json()
    const active = (data.data ?? []).filter((a: DeptDoctor) => a.isActive)
    setDepartmentDoctors(active)
    if (active.length) setDoctorId(active[0].doctorId)
    else setDoctorId('')
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [deptRes, shiftRes] = await Promise.all([
        fetch('/api/facility/departments'),
        fetch('/api/facility/on-call'),
      ])
      const [deptData, shiftData] = await Promise.all([
        deptRes.json(),
        shiftRes.json(),
      ])
      const activeDepts = (deptData.data ?? []).filter((d: Department) => d.isActive)
      setDepartments(activeDepts)
      setShifts(shiftData.data ?? [])
      const initialDept = activeDepts[0]?.id ?? ''
      if (initialDept) {
        setDepartmentId((prev) => prev || initialDept)
        await loadDepartmentDoctors(initialDept)
      }
    } catch {
      setError(tf('on_call_load_error'))
    } finally {
      setLoading(false)
    }
  }, [tf, loadDepartmentDoctors])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && session.user.role !== 'FACILITY') { router.push('/unauthorized'); return }
    const start = new Date()
    start.setMinutes(0, 0, 0)
    const end = new Date(start)
    end.setHours(end.getHours() + 8)
    setStartsAt(toLocalInputValue(start))
    setEndsAt(toLocalInputValue(end))
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router])

  useEffect(() => {
    if (!departmentId || loading) return
    void loadDepartmentDoctors(departmentId)
  }, [departmentId, loading, loadDepartmentDoctors])

  async function addShift(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/facility/on-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId,
          doctorId,
          shiftType,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          notes: notes || undefined,
        }),
      })
      const data = await res.json()
      if (!data.success || data.data?.error) {
        setError(data.data?.message ?? tf('on_call_save_error'))
        return
      }
      setNotes('')
      await load()
    } catch {
      setError(tf('on_call_save_error'))
    } finally {
      setSaving(false)
    }
  }

  async function removeShift(id: string) {
    await fetch(`/api/facility/on-call/${id}`, { method: 'DELETE' })
    await load()
  }

  function formatRange(start: string, end: string) {
    const s = new Date(start)
    const e = new Date(end)
    return `${s.toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })} → ${e.toLocaleString('ar-SA', { timeStyle: 'short' })}`
  }

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <Link href="/dashboard/facility/departments" className="text-slate-400 hover:text-white text-sm">
            ← {tf('departments_title')}
          </Link>
          <h1 className="text-2xl font-bold text-white mt-2">{tf('on_call_title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{tf('on_call_subtitle')}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
          </div>
        ) : departments.length === 0 ? (
          <div className="text-center py-12 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
            <p className="text-slate-400 mb-4">{tf('on_call_need_departments')}</p>
            <Link href="/dashboard/facility/departments" className="text-teal-400 hover:underline text-sm">
              {tf('departments_title')}
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={(e) => void addShift(e)} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-8 space-y-4">
              <h2 className="text-white font-semibold">{tf('on_call_add')}</h2>
              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">{tf('on_call_department')}</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                    required
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id} className="bg-slate-900">
                        {d.icon} {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">{tf('on_call_doctor')}</label>
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                    required
                  >
                    {departmentDoctors.length === 0 ? (
                      <option value="">{tf('on_call_no_dept_doctors')}</option>
                    ) : (
                      departmentDoctors.map((d) => (
                        <option key={d.doctorId} value={d.doctorId} className="bg-slate-900">
                          د. {d.doctor.firstName} {d.doctor.lastName} — {d.doctor.specialization}
                        </option>
                      ))
                    )}
                  </select>
                  {departmentDoctors.length === 0 && (
                    <Link
                      href={`/dashboard/facility/department-doctors?department=${departmentId}`}
                      className="text-teal-400 text-xs mt-1 inline-block hover:underline"
                    >
                      {tf('dept_doctors_link')} →
                    </Link>
                  )}
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">{tf('on_call_starts')}</label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                    required
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">{tf('on_call_ends')}</label>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                    required
                    dir="ltr"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 text-xs mb-1">{tf('on_call_type')}</label>
                  <div className="flex flex-wrap gap-2">
                    {SHIFT_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setShiftType(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs border ${
                          shiftType === t
                            ? 'border-teal-500/40 bg-teal-500/15 text-teal-300'
                            : 'border-white/10 text-slate-400'
                        }`}
                      >
                        {ON_CALL_SHIFT_LABELS[t]?.ar ?? t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 text-xs mb-1">{tf('on_call_notes')}</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                    placeholder={tf('on_call_notes_placeholder')}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || departmentDoctors.length === 0}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? '...' : tf('on_call_add_btn')}
              </button>
            </form>

            <h2 className="text-white font-semibold mb-3">{tf('on_call_upcoming')}</h2>
            {shifts.length === 0 ? (
              <p className="text-slate-500 text-sm">{tf('on_call_empty')}</p>
            ) : (
              <div className="space-y-3">
                {shifts.map((s) => (
                  <div
                    key={s.id}
                    className={`p-4 rounded-2xl border ${
                      s.isActiveNow
                        ? 'border-teal-500/30 bg-teal-500/10'
                        : 'border-white/[0.08] bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {s.isActiveNow && (
                          <span className="inline-block text-xs text-teal-300 mb-1">{tf('on_call_active_now')}</span>
                        )}
                        <p className="text-white font-medium">
                          {s.department.icon} {s.department.name} — {s.doctor.fullName}
                        </p>
                        <p className="text-slate-500 text-xs mt-1">{s.doctor.specialization}</p>
                        <p className="text-slate-400 text-xs mt-1" dir="ltr">{formatRange(s.startsAt, s.endsAt)}</p>
                        <p className="text-slate-500 text-xs">
                          {ON_CALL_SHIFT_LABELS[s.shiftType]?.ar ?? s.shiftType}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeShift(s.id)}
                        className="text-red-400 text-xs hover:underline flex-shrink-0"
                      >
                        {tf('on_call_delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  )
}
