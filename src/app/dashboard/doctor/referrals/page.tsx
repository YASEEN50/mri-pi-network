'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import DoctorSubpageLayout from '@/components/doctor/DoctorSubpageLayout'

interface ReferralItem {
  id: string
  status: string
  reason: string
  notes?: string
  resultNotes?: string
  clientName: string
  fromDoctor: { id: string; name: string; specialization: string }
  toDoctor: { id: string; name: string; specialization: string }
  createdAt: string
}

interface SelectOption {
  id?: string
  clientId?: string
  name: string
  specialization?: string
}

type Direction = 'all' | 'sent' | 'received'

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  ACCEPTED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function DoctorReferralsPage() {
  const tr = useTranslations('dashboard.referrals')
  const tc = useTranslations('common')
  const [referrals, setReferrals] = useState<ReferralItem[]>([])
  const [direction, setDirection] = useState<Direction>('all')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [clients, setClients] = useState<SelectOption[]>([])
  const [colleagues, setColleagues] = useState<SelectOption[]>([])
  const [doctorSearch, setDoctorSearch] = useState('')
  const [form, setForm] = useState({ clientId: '', toDoctorId: '', reason: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [myDoctorId, setMyDoctorId] = useState<string | null>(null)
  const rewardAmount = process.env.NEXT_PUBLIC_REFERRAL_REWARD_PI ?? '1'

  const fetchReferrals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/referrals?direction=${direction}`)
      const data = await res.json()
      setReferrals(data.data ?? [])
    } catch {
      setErr(tc('error'))
    } finally {
      setLoading(false)
    }
  }, [direction, tc])

  useEffect(() => { void fetchReferrals() }, [fetchReferrals])

  useEffect(() => {
    if (!showForm) return
    fetch('/api/referrals/clients').then(r => r.json()).then(d => setClients(d.data ?? [])).catch(() => {})
  }, [showForm])

  useEffect(() => {
    if (!showForm) return
    const t = setTimeout(() => {
      fetch(`/api/referrals/colleagues?q=${encodeURIComponent(doctorSearch)}`)
        .then(r => r.json())
        .then(d => setColleagues(d.data ?? []))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [showForm, doctorSearch])

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => setMyDoctorId(d.data?.id ?? null))
      .catch(() => {})
  }, [])

  async function updateStatus(id: string, status: string, resultNotes?: string) {
    setErr('')
    const res = await fetch(`/api/referrals/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resultNotes }),
    })
    const data = await res.json()
    if (data.data?.error) setErr(data.data.message)
    else void fetchReferrals()
  }

  async function handleCreate() {
    if (!form.clientId || !form.toDoctorId || form.reason.length < 5) return
    setSaving(true)
    setErr('')
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.data?.error || !data.success) {
        setErr(data.data?.message ?? data.error?.message ?? tc('error'))
      } else {
        setMsg(tr('created'))
        setShowForm(false)
        setForm({ clientId: '', toDoctorId: '', reason: '', notes: '' })
        void fetchReferrals()
      }
    } catch {
      setErr(tc('error'))
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  return (
    <DoctorSubpageLayout title={tr('title')} subtitle={tr('subtitle')} maxWidth="4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-emerald-400/90">{tr('reward_hint', { amount: rewardAmount })}</p>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-sm font-medium rounded-xl transition-all"
        >
          {tr('new_referral')}
        </button>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl">{msg}</div>
      )}
      {err && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">{err}</div>
      )}

      <div className="flex gap-2 mb-6">
        {(['all', 'sent', 'received'] as Direction[]).map(d => (
          <button
            key={d}
            onClick={() => setDirection(d)}
            className={`px-4 py-2 rounded-xl text-sm border transition-all ${
              direction === d
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
            }`}
          >
            {tr(`tab_${d}` as 'tab_all')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : referrals.length === 0 ? (
        <div className="text-center py-20 text-slate-400">{tr('empty')}</div>
      ) : (
        <div className="space-y-4">
          {referrals.map(ref => {
            const isReceiver = myDoctorId === ref.toDoctor.id
            const isSender = myDoctorId === ref.fromDoctor.id
            return (
              <div key={ref.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[ref.status] ?? ''}`}>
                        {tr(`status.${ref.status}` as 'status.PENDING')}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(ref.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">{tr('patient')}: {ref.clientName}</p>
                    <p className="text-slate-400 text-xs mb-1">{tr('from')}: {ref.fromDoctor.name} · {ref.fromDoctor.specialization}</p>
                    <p className="text-slate-400 text-xs mb-2">{tr('to')}: {ref.toDoctor.name} · {ref.toDoctor.specialization}</p>
                    <p className="text-slate-300 text-sm">{tr('reason')}: {ref.reason}</p>
                    {ref.notes && <p className="text-slate-500 text-xs mt-1">{tr('notes')}: {ref.notes}</p>}
                    {ref.resultNotes && <p className="text-slate-500 text-xs mt-1">{tr('result_notes')}: {ref.resultNotes}</p>}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {isReceiver && ref.status === 'PENDING' && (
                      <button onClick={() => void updateStatus(ref.id, 'ACCEPTED')}
                        className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-medium">
                        {tr('accept')}
                      </button>
                    )}
                    {isReceiver && ref.status === 'ACCEPTED' && (
                      <button onClick={() => void updateStatus(ref.id, 'COMPLETED')}
                        className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium">
                        {tr('complete')}
                      </button>
                    )}
                    {ref.status !== 'COMPLETED' && ref.status !== 'CANCELLED' && (isReceiver || isSender) && (
                      <button onClick={() => void updateStatus(ref.id, 'CANCELLED')}
                        className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
                        {tr('cancel')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-900 border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-white font-bold mb-4">{tr('create_title')}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-slate-300 text-sm mb-2 block">{tr('select_patient')}</label>
                <select
                  value={form.clientId}
                  onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                >
                  <option value="" className="bg-slate-900">—</option>
                  {clients.map(c => (
                    <option key={c.clientId} value={c.clientId} className="bg-slate-900">{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-300 text-sm mb-2 block">{tr('select_doctor')}</label>
                <input
                  value={doctorSearch}
                  onChange={e => setDoctorSearch(e.target.value)}
                  placeholder={tr('search_doctor')}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mb-2"
                />
                <select
                  value={form.toDoctorId}
                  onChange={e => setForm(p => ({ ...p, toDoctorId: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                >
                  <option value="" className="bg-slate-900">—</option>
                  {colleagues.map(d => (
                    <option key={d.id} value={d.id} className="bg-slate-900">
                      {d.name}{d.specialization ? ` · ${d.specialization}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-300 text-sm mb-2 block">{tr('reason')} *</label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none"
                />
              </div>
              <div>
                <label className="text-slate-300 text-sm mb-2 block">{tr('notes')}</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => void handleCreate()}
                disabled={saving || !form.clientId || !form.toDoctorId || form.reason.length < 5}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm"
              >
                {saving ? tr('creating') : tr('submit')}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-sm"
              >
                {tc('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DoctorSubpageLayout>
  )
}
