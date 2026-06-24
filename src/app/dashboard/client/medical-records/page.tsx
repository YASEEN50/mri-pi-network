'use client'
// src/app/dashboard/client/medical-records/page.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import DashboardShell from '@/components/dashboard/DashboardShell'

const RECORD_TYPES = ['PRESCRIPTION', 'LAB_RESULT', 'RADIOLOGY_REPORT', 'DIAGNOSIS', 'DISCHARGE_SUMMARY', 'VACCINATION', 'OTHER'] as const

const TYPE_ICONS: Record<string, string> = {
  PRESCRIPTION: '💊',
  LAB_RESULT: '🧪',
  RADIOLOGY_REPORT: '🩻',
  DIAGNOSIS: '🔬',
  DISCHARGE_SUMMARY: '📋',
  VACCINATION: '💉',
  OTHER: '📄',
}

interface MedicalRecord {
  id: string
  type: string
  title: string
  description?: string
  fileUrl?: string
  isShared: boolean
  createdAt: string
  doctor?: string
}

export default function MedicalRecordsPage() {
  const { status } = useSession()
  const router = useRouter()
  const t = useTranslations()
  const tm = useTranslations('dashboard.medical_records')
  const td = useTranslations('dashboard')
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({
    type: 'OTHER',
    title: '',
    description: '',
    isShared: false,
    shareConsent: false,
  })
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const fetchRecords = useCallback(async () => {
    try {
      const url =
        filter !== 'all' ? `/api/medical-records?type=${filter}` : '/api/medical-records'
      const res = await fetch(url)
      const data = await res.json()
      setRecords(data.data ?? [])
    } catch {
      setErr(tm('load_error'))
    } finally {
      setLoading(false)
    }
  }, [filter, tm])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status !== 'authenticated') return
    void fetchRecords()
  }, [status, router, fetchRecords])

  async function handleAdd() {
    if (!form.title) return
    if (form.isShared && !form.shareConsent) {
      setErr(tm('consent_required'))
      return
    }

    setSaving(true)
    setErr('')
    try {
      const fd = new FormData()
      fd.append('type', form.type)
      fd.append('title', form.title)
      if (form.description) fd.append('description', form.description)
      fd.append('isShared', String(form.isShared))
      fd.append('shareConsent', String(form.shareConsent))
      if (file) fd.append('file', file)

      const res = await fetch('/api/medical-records', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.data?.id) {
        setShowAdd(false)
        setForm({ type: 'OTHER', title: '', description: '', isShared: false, shareConsent: false })
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        setMsg(tm('added'))
        fetchRecords()
      } else {
        setErr(data.message ?? data.data?.message ?? t('common.error'))
      }
    } catch {
      setErr(tm('connection_error'))
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  async function toggleShare(id: string, current: boolean) {
    if (!current) {
      const agreed = confirm(tm('share_confirm'))
      if (!agreed) return
    }

    await fetch(`/api/medical-records/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isShared: !current,
        shareConsent: !current ? true : undefined,
      }),
    })
    fetchRecords()
  }

  async function deleteRecord(id: string) {
    if (!confirm(tm('delete_confirm'))) return
    await fetch(`/api/medical-records/${id}`, { method: 'DELETE' })
    fetchRecords()
  }

  const filtered = filter === 'all' ? records : records.filter((r) => r.type === filter)

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">{tm('title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{tm('count', { count: records.length })}</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-sm font-medium rounded-xl transition-all"
          >
            {tm('add')}
          </button>
        </div>

        {msg && (
          <div className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl">
            {msg}
          </div>
        )}
        {err && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">
            {err}
          </div>
        )}

        <div className="flex gap-2 mb-6 flex-wrap">
          {['all', ...RECORD_TYPES].map((typeKey) => (
            <button
              key={typeKey}
              onClick={() => setFilter(typeKey)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                filter === typeKey
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
            >
              {typeKey === 'all' ? tm('all') : tm(`types.${typeKey}` as 'types.OTHER')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-slate-400">{tm('empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((rec) => (
              <div
                key={rec.id}
                className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{TYPE_ICONS[rec.type] ?? '📄'}</span>
                    <div>
                      <p className="text-white font-medium text-sm">{rec.title}</p>
                      <p className="text-slate-400 text-xs">{tm(`types.${rec.type}` as 'types.OTHER')}</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full border ${
                      rec.isShared
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        : 'bg-white/5 border-white/10 text-slate-500'
                    }`}
                  >
                    {rec.isShared ? tm('shared') : tm('private')}
                  </span>
                </div>
                {rec.description && (
                  <p className="text-slate-400 text-xs mb-3 line-clamp-2">{rec.description}</p>
                )}
                {rec.doctor && (
                  <p className="text-slate-500 text-xs mb-3">{td('doctor_label')}: {rec.doctor}</p>
                )}
                {rec.fileUrl && (
                  <a
                    href={rec.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs text-emerald-400 hover:underline mb-3"
                  >
                    {tm('view_file')}
                  </a>
                )}
                <div className="flex gap-2 pt-3 border-t border-white/5">
                  <button
                    onClick={() => toggleShare(rec.id, rec.isShared)}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    {rec.isShared ? tm('stop_sharing') : tm('share_with_doctor')}
                  </button>
                  <button
                    onClick={() => deleteRecord(rec.id)}
                    className="text-xs text-red-400/60 hover:text-red-400 transition-colors ms-auto"
                  >
                    {tm('delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showAdd && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-slate-900 border border-white/[0.08] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-white font-bold mb-4">{tm('add_title')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm mb-2 block">{tm('type_label')}</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
                  >
                    {RECORD_TYPES.map((v) => (
                      <option key={v} value={v} className="bg-slate-900">
                        {tm(`types.${v}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 text-sm mb-2 block">{tm('title_label')}</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder={tm('title_placeholder')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="text-slate-300 text-sm mb-2 block">{tm('description_label')}</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    placeholder={tm('description_placeholder')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300 text-sm mb-2 block">{tm('file_label')}</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-slate-400 file:me-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-500/20 file:text-emerald-400"
                  />
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isShared}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        isShared: e.target.checked,
                        shareConsent: e.target.checked ? p.shareConsent : false,
                      }))
                    }
                    className="mt-1"
                  />
                  <span className="text-slate-300 text-sm leading-relaxed">
                    {tm('share_checkbox')}
                  </span>
                </label>
                {form.isShared && (
                  <label className="flex items-start gap-3 cursor-pointer ms-6">
                    <input
                      type="checkbox"
                      checked={form.shareConsent}
                      onChange={(e) => setForm((p) => ({ ...p, shareConsent: e.target.checked }))}
                      className="mt-1"
                    />
                    <span className="text-slate-400 text-xs leading-relaxed">
                      {tm('consent_checkbox')}
                    </span>
                  </label>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAdd}
                  disabled={saving || !form.title}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all"
                >
                  {saving ? tm('saving') : tm('add_btn')}
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
