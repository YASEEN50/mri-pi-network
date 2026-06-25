'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import DashboardShell from '@/components/dashboard/DashboardShell'

interface Department {
  id: string
  code: string | null
  name: string
  nameEn: string | null
  icon: string | null
  floor: string | null
  phone: string | null
  isActive: boolean
  shiftsCount: number
  doctorsCount: number
}

export default function FacilityDepartmentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const tf = useTranslations('dashboard.facility')
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/facility/departments')
      const data = await res.json()
      setDepartments(data.data ?? [])
    } catch {
      setMessage(tf('departments_load_error'))
    } finally {
      setLoading(false)
    }
  }, [tf])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && session.user.role !== 'FACILITY') { router.push('/unauthorized'); return }
    void load()
  }, [session, status, router, load])

  async function seedDefaults() {
    setSeeding(true)
    setMessage('')
    try {
      const res = await fetch('/api/facility/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_defaults' }),
      })
      const data = await res.json()
      if (!data.success) {
        setMessage(data.error?.message ?? tf('departments_seed_error'))
        return
      }
      setMessage(tf('departments_seeded', { count: data.data?.seeded ?? 0 }))
      await load()
    } catch {
      setMessage(tf('departments_seed_error'))
    } finally {
      setSeeding(false)
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/facility/departments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    await load()
  }

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <Link href="/dashboard/facility/overview" className="text-slate-400 hover:text-white text-sm">
              ← {tf('overview_title')}
            </Link>
            <h1 className="text-2xl font-bold text-white mt-2">{tf('departments_title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{tf('departments_subtitle')}</p>
          </div>
          <div className="flex gap-2">
            {departments.length === 0 && (
              <button
                type="button"
                onClick={() => void seedDefaults()}
                disabled={seeding}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {seeding ? '...' : tf('departments_seed_btn')}
              </button>
            )}
            <Link
              href="/dashboard/facility/on-call"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm"
            >
              {tf('on_call_link')}
            </Link>
            <Link
              href="/dashboard/facility/department-doctors"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm"
            >
              {tf('dept_doctors_link')}
            </Link>
          </div>
        </div>

        {message && (
          <p className="mb-4 text-sm text-teal-400">{message}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
          </div>
        ) : departments.length === 0 ? (
          <div className="text-center py-16 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
            <p className="text-4xl mb-3">🏥</p>
            <p className="text-slate-400 mb-4">{tf('departments_empty')}</p>
            <button
              type="button"
              onClick={() => void seedDefaults()}
              disabled={seeding}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium"
            >
              {tf('departments_seed_btn')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {departments.map((d) => (
              <div
                key={d.id}
                className={`flex items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
                  d.isActive
                    ? 'bg-white/[0.03] border-white/[0.08]'
                    : 'bg-white/[0.02] border-white/[0.05] opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl">{d.icon ?? '🏥'}</span>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{d.name}</p>
                    <p className="text-slate-500 text-xs">
                      {d.floor ? `${tf('floor')}: ${d.floor} · ` : ''}
                      {tf('doctors_count_short', { count: d.doctorsCount })} · {tf('shifts_count', { count: d.shiftsCount })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/dashboard/facility/department-doctors?department=${d.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-slate-300 bg-white/5 hover:bg-white/10"
                  >
                    {tf('dept_doctors_manage')}
                  </Link>
                  <button
                  type="button"
                  onClick={() => void toggleActive(d.id, d.isActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    d.isActive
                      ? 'border-teal-500/30 text-teal-400 bg-teal-500/10'
                      : 'border-white/10 text-slate-400 bg-white/5'
                  }`}
                >
                  {d.isActive ? tf('active') : tf('inactive')}
                </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
