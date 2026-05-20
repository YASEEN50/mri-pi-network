'use client'
// src/app/dashboard/client/medical-records/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/common/Navbar'

const TYPE_LABELS: { [key: string]: string } = {
  PRESCRIPTION:      'وصفة طبية',
  LAB_RESULT:        'نتيجة تحليل',
  RADIOLOGY_REPORT:  'تقرير أشعة',
  DIAGNOSIS:         'تشخيص',
  DISCHARGE_SUMMARY: 'ملخص خروج',
  VACCINATION:       'تطعيم',
  OTHER:             'أخرى',
}

const TYPE_ICONS: { [key: string]: string } = {
  PRESCRIPTION: '💊', LAB_RESULT: '🧪', RADIOLOGY_REPORT: '🩻',
  DIAGNOSIS: '🔬', DISCHARGE_SUMMARY: '📋', VACCINATION: '💉', OTHER: '📄',
}

interface MedicalRecord { id: string; type: string; title: string; description?: string; fileUrl?: string; isShared: boolean; createdAt: string; doctor?: string }

export default function MedicalRecordsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [records,  setRecords]  = useState<MedicalRecord[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)
  const [filter,   setFilter]   = useState('all')
  const [form,     setForm]     = useState({ type: 'OTHER', title: '', description: '', fileUrl: '' })
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState('')

  const fetchRecords = useCallback(async () => {
    try {
      const url  = filter !== 'all' ? `/api/medical-records?type=${filter}` : '/api/medical-records'
      const res  = await fetch(url)
      const data = await res.json()
      setRecords(data.data ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status !== 'authenticated') return
    void fetchRecords()
  }, [status, router, fetchRecords])

  async function handleAdd() {
    if (!form.title) return
    setSaving(true)
    try {
      const res  = await fetch('/api/medical-records', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (data.data?.id) { setShowAdd(false); setMsg('✅ تم إضافة السجل'); fetchRecords() }
    } catch {}
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  async function toggleShare(id: string, current: boolean) {
    await fetch(`/api/medical-records/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ isShared: !current }),
    })
    fetchRecords()
  }

  async function deleteRecord(id: string) {
    if (!confirm('هل تريد حذف هذا السجل؟')) return
    await fetch(`/api/medical-records/${id}`, { method: 'DELETE' })
    fetchRecords()
  }

  const filtered = filter === 'all' ? records : records.filter(r => r.type === filter)

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">السجل الطبي</h1>
            <p className="text-slate-400 text-sm mt-1">{records.length} سجل طبي</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-sm font-medium rounded-xl transition-all">
            + إضافة سجل
          </button>
        </div>

        {msg && (
          <div className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl">{msg}</div>
        )}

        {/* فلاتر */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {['all', ...Object.keys(TYPE_LABELS)].map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all
                ${filter === t
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
              {t === 'all' ? 'الكل' : TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* السجلات */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-slate-400">لا توجد سجلات بعد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map(rec => (
              <div key={rec.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{TYPE_ICONS[rec.type] ?? '📄'}</span>
                    <div>
                      <p className="text-white font-medium text-sm">{rec.title}</p>
                      <p className="text-slate-400 text-xs">{TYPE_LABELS[rec.type]}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${rec.isShared ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                    {rec.isShared ? 'مشارك' : 'خاص'}
                  </span>
                </div>
                {rec.description && <p className="text-slate-400 text-xs mb-3 line-clamp-2">{rec.description}</p>}
                {rec.doctor && <p className="text-slate-500 text-xs mb-3">الطبيب: {rec.doctor}</p>}
                {rec.fileUrl && (
                  <a href={rec.fileUrl} target="_blank" rel="noreferrer"
                    className="inline-block text-xs text-emerald-400 hover:underline mb-3">
                    📎 عرض الملف
                  </a>
                )}
                <div className="flex gap-2 pt-3 border-t border-white/5">
                  <button onClick={() => toggleShare(rec.id, rec.isShared)}
                    className="text-xs text-slate-400 hover:text-white transition-colors">
                    {rec.isShared ? 'إيقاف المشاركة' : 'مشاركة مع الطبيب'}
                  </button>
                  <button onClick={() => deleteRecord(rec.id)}
                    className="text-xs text-red-400/60 hover:text-red-400 transition-colors mr-auto">
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* نموذج الإضافة */}
        {showAdd && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" dir="rtl">
            <div className="bg-slate-900 border border-white/[0.08] rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-white font-bold mb-4">إضافة سجل طبي</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm mb-2 block">نوع السجل</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none">
                    {Object.entries(TYPE_LABELS).map(([v, l]: [string, string]) => (
                      <option key={v} value={v} className="bg-slate-900">{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 text-sm mb-2 block">العنوان *</label>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="وصفة دكتور أحمد - مارس 2025"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="text-slate-300 text-sm mb-2 block">الوصف</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    rows={3} placeholder="تفاصيل إضافية..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none" />
                </div>
                <div>
                  <label className="text-slate-300 text-sm mb-2 block">رابط الملف (اختياري)</label>
                  <input value={form.fileUrl} onChange={e => setForm(p => ({ ...p, fileUrl: e.target.value }))}
                    placeholder="https://..." dir="ltr"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleAdd} disabled={saving || !form.title}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all">
                  {saving ? 'جاري الحفظ...' : 'إضافة'}
                </button>
                <button onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
