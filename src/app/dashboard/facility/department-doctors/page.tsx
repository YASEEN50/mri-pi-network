'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import DashboardShell from '@/components/dashboard/DashboardShell'

interface Department {
  id: string
  name: string
  icon: string | null
  isActive: boolean
  doctorsCount: number
}

interface FacilityDoctor {
  doctorId: string
  doctor: { firstName: string; lastName: string; specialization: string }
}

interface Assignment {
  id: string
  doctorId: string
  role: string | null
  isActive: boolean
  doctor: {
    id: string
    firstName: string
    lastName: string
    specialization: string
  }
}

function DepartmentDoctorsContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tf = useTranslations('dashboard.facility')

  const [departments, setDepartments] = useState<Department[]>([])
  const [facilityDoctors, setFacilityDoctors] = useState<FacilityDoctor[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [addDoctorId, setAddDoctorId] = useState('')
  const [addRole, setAddRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadDepartments = useCallback(async () => {
    const res = await fetch('/api/facility/departments')
    const data = await res.json()
    const active = (data.data ?? []).filter((d: Department) => d.isActive)
    setDepartments(active)
    return active as Department[]
  }, [])

  const loadFacilityDoctors = useCallback(async () => {
    const res = await fetch('/api/facility/doctors')
    const data = await res.json()
    setFacilityDoctors(data.data ?? [])
    return (data.data ?? []) as FacilityDoctor[]
  }, [])

  const loadAssignments = useCallback(async (departmentId: string) => {
    if (!departmentId) {
      setAssignments([])
      return
    }
    const res = await fetch(`/api/facility/departments/${departmentId}/doctors`)
    const data = await res.json()
    setAssignments(data.data ?? [])
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && session.user.role !== 'FACILITY') { router.push('/unauthorized'); return }

    void (async () => {
      setLoading(true)
      try {
        const [depts] = await Promise.all([loadDepartments(), loadFacilityDoctors()])
        const fromUrl = searchParams.get('department')
        const initial =
          (fromUrl && depts.some((d) => d.id === fromUrl) ? fromUrl : null) ??
          depts[0]?.id ??
          ''
        setSelectedDeptId(initial)
        if (initial) await loadAssignments(initial)
      } catch {
        setError(tf('dept_doctors_load_error'))
      } finally {
        setLoading(false)
      }
    })()
  }, [session, status, router, searchParams, loadDepartments, loadFacilityDoctors, loadAssignments, tf])

  useEffect(() => {
    if (!selectedDeptId || loading) return
    void loadAssignments(selectedDeptId)
  }, [selectedDeptId, loading, loadAssignments])

  const assignedIds = new Set(assignments.map((a) => a.doctorId))
  const availableDoctors = facilityDoctors.filter((d) => !assignedIds.has(d.doctorId))

  async function assignDoctor(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDeptId || !addDoctorId) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch(`/api/facility/departments/${selectedDeptId}/doctors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId: addDoctorId, role: addRole || undefined }),
      })
      const data = await res.json()
      if (!data.success || data.data?.error) {
        setError(data.data?.message ?? tf('dept_doctors_assign_error'))
        return
      }
      setMessage(tf('dept_doctors_assigned'))
      setAddDoctorId('')
      setAddRole('')
      await Promise.all([loadAssignments(selectedDeptId), loadDepartments()])
    } catch {
      setError(tf('dept_doctors_assign_error'))
    } finally {
      setSaving(false)
    }
  }

  async function removeAssignment(doctorId: string) {
    if (!selectedDeptId) return
    setError('')
    await fetch(`/api/facility/departments/${selectedDeptId}/doctors/${doctorId}`, {
      method: 'DELETE',
    })
    await Promise.all([loadAssignments(selectedDeptId), loadDepartments()])
  }

  async function toggleAssignment(doctorId: string, isActive: boolean) {
    if (!selectedDeptId) return
    await fetch(`/api/facility/departments/${selectedDeptId}/doctors/${doctorId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    await loadAssignments(selectedDeptId)
  }

  const selectedDept = departments.find((d) => d.id === selectedDeptId)

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <Link href="/dashboard/facility/departments" className="text-slate-400 hover:text-white text-sm">
            ← {tf('departments_title')}
          </Link>
          <h1 className="text-2xl font-bold text-white mt-2">{tf('dept_doctors_title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{tf('dept_doctors_subtitle')}</p>
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
            <div className="mb-6">
              <label className="block text-slate-400 text-xs mb-1">{tf('on_call_department')}</label>
              <select
                value={selectedDeptId}
                onChange={(e) => {
                  setSelectedDeptId(e.target.value)
                  setMessage('')
                  setError('')
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900">
                    {d.icon} {d.name} ({tf('doctors_count_short', { count: d.doctorsCount })})
                  </option>
                ))}
              </select>
            </div>

            {facilityDoctors.length === 0 ? (
              <div className="text-center py-10 bg-white/[0.03] border border-white/[0.08] rounded-2xl mb-6">
                <p className="text-slate-400 mb-3">{tf('on_call_no_doctors')}</p>
                <Link href="/dashboard/facility/doctors" className="text-teal-400 hover:underline text-sm">
                  {tf('doctors_title')}
                </Link>
              </div>
            ) : (
              <form
                onSubmit={(e) => void assignDoctor(e)}
                className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-6 space-y-4"
              >
                <h2 className="text-white font-semibold text-sm">
                  {tf('dept_doctors_add', { department: selectedDept?.name ?? '' })}
                </h2>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                {message && <p className="text-teal-400 text-sm">{message}</p>}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">{tf('dept_doctors_select')}</label>
                    <select
                      value={addDoctorId}
                      onChange={(e) => setAddDoctorId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                      required
                    >
                      <option value="" className="bg-slate-900">{tf('dept_doctors_select_placeholder')}</option>
                      {availableDoctors.map((d) => (
                        <option key={d.doctorId} value={d.doctorId} className="bg-slate-900">
                          د. {d.doctor.firstName} {d.doctor.lastName} — {d.doctor.specialization}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">{tf('dept_doctors_role')}</label>
                    <input
                      value={addRole}
                      onChange={(e) => setAddRole(e.target.value)}
                      placeholder={tf('dept_doctors_role_placeholder')}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving || !addDoctorId || availableDoctors.length === 0}
                  className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {saving ? '...' : tf('dept_doctors_add_btn')}
                </button>
                {availableDoctors.length === 0 && assignments.length > 0 && (
                  <p className="text-slate-500 text-xs text-center">{tf('dept_doctors_all_assigned')}</p>
                )}
              </form>
            )}

            <h2 className="text-white font-semibold mb-3 text-sm">{tf('dept_doctors_list')}</h2>
            {assignments.length === 0 ? (
              <p className="text-slate-500 text-sm">{tf('dept_doctors_empty')}</p>
            ) : (
              <div className="space-y-3">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between gap-4 p-4 rounded-2xl border ${
                      a.isActive
                        ? 'bg-white/[0.03] border-white/[0.08]'
                        : 'bg-white/[0.02] border-white/[0.05] opacity-60'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-white font-medium">
                        د. {a.doctor.firstName} {a.doctor.lastName}
                      </p>
                      <p className="text-emerald-400 text-sm">{a.doctor.specialization}</p>
                      {a.role && <p className="text-slate-500 text-xs mt-0.5">{a.role}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => void toggleAssignment(a.doctorId, a.isActive)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                          a.isActive
                            ? 'border-teal-500/30 text-teal-400 bg-teal-500/10'
                            : 'border-white/10 text-slate-400 bg-white/5'
                        }`}
                      >
                        {a.isActive ? tf('active') : tf('inactive')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeAssignment(a.doctorId)}
                        className="text-red-400 text-xs hover:underline"
                      >
                        {tf('dept_doctors_remove')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-white/[0.08]">
              <Link
                href="/dashboard/facility/on-call"
                className="text-teal-400 hover:underline text-sm"
              >
                {tf('on_call_link')} →
              </Link>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}

export default function FacilityDepartmentDoctorsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <DepartmentDoctorsContent />
    </Suspense>
  )
}
