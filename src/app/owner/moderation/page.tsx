'use client'
// src/app/owner/moderation/page.tsx — لوحة مراقبة المحتوى
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'

const REASON_LABELS: Record<string,string> = {
  INAPPROPRIATE_CONTENT: 'محتوى غير لائق',
  FAKE_INFORMATION:      'معلومات مضللة',
  SPAM:                  'بريد عشوائي',
  HARASSMENT:            'تحرش أو إيذاء',
  OTHER:                 'أخرى',
}
const TYPE_LABELS: Record<string,string> = {
  PUBLICATION:  'مقال طبي', REVIEW: 'تقييم',
  CHAT_MESSAGE: 'رسالة',   PROFILE: 'ملف شخصي',
}
const STATUS_STYLES: Record<string,string> = {
  PENDING:      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  REVIEWED:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  ACTION_TAKEN: 'bg-red-500/10 text-red-400 border-red-500/20',
  DISMISSED:    'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

export default function ModerationPage() {
  const { data: session, status } = useSession()
  const router  = useRouter()
  const [reports,  setReports]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('PENDING')
  const [selected, setSelected] = useState<any | null>(null)
  const [action,   setAction]   = useState({ status: 'REVIEWED', notes: '', actionTaken: '' })
  const [saving,   setSaving]   = useState(false)
  const [stats,    setStats]    = useState({ pending: 0, reviewed: 0, action_taken: 0 })

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/moderation/reports?status=PENDING&limit=100'),
        fetch('/api/moderation/reports?status=REVIEWED&limit=5'),
        fetch('/api/moderation/reports?status=ACTION_TAKEN&limit=5'),
      ])
      const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()])
      setStats({ pending: d1.meta?.total ?? 0, reviewed: d2.meta?.total ?? 0, action_taken: d3.meta?.total ?? 0 })
      const res  = await fetch(`/api/moderation/reports?status=${filter}`)
      const data = await res.json()
      setReports(data.data ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && !['OWNER','ADMIN'].includes(session?.user?.role ?? '')) { router.push('/unauthorized'); return }
    if (status !== 'authenticated') return
    void fetchReports()
  }, [status, session, router, fetchReports])

  async function handleAction() {
    if (!selected) return
    setSaving(true)
    try {
      await fetch(`/api/moderation/reports/${selected.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(action),
      })
      setSelected(null)
      fetchReports()
    } catch {}
    finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen" style={{background:'#0a0d14'}} dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/owner" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← لوحة التحكم</Link>
              <span className="text-slate-600">/</span>
              <span className="text-white text-sm">مراقبة المحتوى</span>
            </div>
            <h1 className="text-2xl font-bold text-white">مراقبة المحتوى</h1>
            <p className="text-slate-400 text-sm mt-0.5">مراجعة تقارير المحتوى المخالف</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'بانتظار المراجعة', value: stats.pending,      clr: '#f59e0b', icon: '⚠️' },
            { label: 'تمت المراجعة',     value: stats.reviewed,     clr: '#3b82f6', icon: '✅' },
            { label: 'تم الإجراء',       value: stats.action_taken, clr: '#ef4444', icon: '🚫' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4"
              style={{background:`${s.clr}10`,border:`1px solid ${s.clr}25`}}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs mt-1" style={{color:s.clr}}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-5">
          {['PENDING','REVIEWED','ACTION_TAKEN','DISMISSED'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-medium border transition-all
                ${filter === f ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
              {{PENDING:'معلق',REVIEWED:'تمت المراجعة',ACTION_TAKEN:'تم الإجراء',DISMISSED:'مرفوض'}[f]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* قائمة التقارير */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-16 rounded-2xl" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                <div className="text-4xl mb-2">🎉</div>
                <p className="text-slate-400 text-sm">لا توجد تقارير معلقة</p>
              </div>
            ) : reports.map(r => (
              <div key={r.id}
                onClick={() => { setSelected(r); setAction({ status: 'REVIEWED', notes: '', actionTaken: '' }) }}
                className={`rounded-2xl p-4 cursor-pointer transition-all
                  ${selected?.id === r.id ? 'ring-2 ring-emerald-500/40' : 'hover:bg-white/5'}`}
                style={{background: selected?.id === r.id ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', border:`1px solid ${selected?.id === r.id ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`}}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{r.contentType === 'PUBLICATION' ? '📝' : r.contentType === 'REVIEW' ? '⭐' : r.contentType === 'CHAT_MESSAGE' ? '💬' : '👤'}</span>
                    <div>
                      <p className="text-white text-sm font-medium">{TYPE_LABELS[r.contentType] ?? r.contentType}</p>
                      <p className="text-slate-500 text-xs">{r.reporter?.email ?? r.reporter?.piUsername ?? 'مجهول'}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_STYLES[r.status]}`}>
                    {({'PENDING':'معلق','REVIEWED':'مراجَع','ACTION_TAKEN':'إجراء','DISMISSED':'مرفوض'} as Record<string,string>)[r.status] ?? r.status}
                  </span>
                </div>
                <p className="text-amber-400 text-xs font-medium mb-1">{REASON_LABELS[r.reason] ?? r.reason}</p>
                {r.description && <p className="text-slate-400 text-xs line-clamp-2">{r.description}</p>}
                <p className="text-slate-600 text-xs mt-2">{new Date(r.createdAt).toLocaleDateString('ar-SA')}</p>
              </div>
            ))}
          </div>

          {/* لوحة الإجراء */}
          <div className="sticky top-6">
            {selected ? (
              <div className="rounded-2xl p-5" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
                <h3 className="text-white font-semibold mb-4">معالجة التقرير</h3>

                <div className="space-y-3 mb-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">نوع المحتوى</span>
                    <span className="text-white">{TYPE_LABELS[selected.contentType]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">السبب</span>
                    <span className="text-amber-400">{REASON_LABELS[selected.reason]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">المُبلِّغ</span>
                    <span className="text-white text-xs">{selected.reporter?.email}</span>
                  </div>
                  {selected.description && (
                    <div className="pt-2 border-t border-white/5">
                      <p className="text-slate-400 text-xs mb-1">التفاصيل</p>
                      <p className="text-slate-300 text-xs">{selected.description}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-slate-300 text-sm mb-2 block">الإجراء</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { v:'REVIEWED',     l:'تمت المراجعة', clr:'#3b82f6' },
                        { v:'ACTION_TAKEN', l:'إجراء تأديبي', clr:'#ef4444' },
                        { v:'DISMISSED',    l:'رفض التقرير',  clr:'#64748b' },
                      ].map(opt => (
                        <button key={opt.v}
                          onClick={() => setAction(p => ({...p, status: opt.v}))}
                          className="px-3 py-2 rounded-xl text-xs font-medium border transition-all"
                          style={{
                            background: action.status === opt.v ? `${opt.clr}20` : 'rgba(255,255,255,0.05)',
                            border:     action.status === opt.v ? `1px solid ${opt.clr}50` : '1px solid rgba(255,255,255,0.1)',
                            color:      action.status === opt.v ? opt.clr : '#94a3b8',
                          }}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {action.status === 'ACTION_TAKEN' && (
                    <div>
                      <label className="text-slate-300 text-sm mb-2 block">الإجراء المتخذ</label>
                      <input value={action.actionTaken}
                        onChange={e => setAction(p => ({...p, actionTaken: e.target.value}))}
                        placeholder="مثال: تم إخفاء المحتوى، تم تحذير المستخدم..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-red-500/50" />
                    </div>
                  )}

                  <div>
                    <label className="text-slate-300 text-sm mb-2 block">ملاحظات المراجعة</label>
                    <textarea value={action.notes}
                      onChange={e => setAction(p => ({...p, notes: e.target.value}))}
                      rows={3} placeholder="ملاحظات اختيارية..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none" />
                  </div>

                  <button onClick={handleAction} disabled={saving}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                    style={{background:'linear-gradient(135deg, #10b981, #0891b2)'}}>
                    {saving ? 'جاري الحفظ...' : 'تأكيد الإجراء'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-8 text-center" style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)'}}>
                <div className="text-4xl mb-3">👆</div>
                <p className="text-slate-400 text-sm">اختر تقريراً من القائمة للمراجعة</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
