'use client'
// src/app/dashboard/doctor/publications/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'

interface Pub { id: string; title: string; type: string; status: string; viewCount: number; likeCount: number; publishedAt?: string; createdAt: string }

const TYPE_OPTS = [
  { v: 'ARTICLE', l: 'مقال طبي' },
  { v: 'RESEARCH', l: 'بحث علمي' },
  { v: 'CASE_STUDY', l: 'دراسة حالة' },
  { v: 'ANNOUNCEMENT', l: 'إعلان' },
]

export default function DoctorPublicationsPage() {
  const { data: session, status } = useSession()
  const router  = useRouter()
  const [pubs,    setPubs]    = useState<Pub[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form,    setForm]    = useState({ title: '', summary: '', content: '', type: 'ARTICLE', tags: '', publish: false })
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')

  const fetchPubs = useCallback(async () => {
    try {
      const res  = await fetch('/api/publications?mine=true&limit=50')
      const data = await res.json()
      setPubs(data.data ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && session.user.role !== 'DOCTOR') { router.push('/unauthorized'); return }
    void fetchPubs()
  }, [session, status, router, fetchPubs])

  async function handleCreate() {
    if (!form.title || !form.content) return
    setSaving(true)
    try {
      const res  = await fetch('/api/publications', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...form,
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (data.data?.id) {
        setShowNew(false)
        setForm({ title: '', summary: '', content: '', type: 'ARTICLE', tags: '', publish: false })
        setMsg('✅ تم نشر المقال بنجاح')
        fetchPubs()
        setTimeout(() => setMsg(''), 3000)
      }
    } catch {}
    finally { setSaving(false) }
  }

  async function togglePublish(id: string, published: boolean) {
    await fetch(`/api/publications/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ publish: !published }),
    })
    fetchPubs()
  }

  async function deletePub(id: string) {
    if (!confirm('حذف هذا المنشور؟')) return
    await fetch(`/api/publications/${id}`, { method: 'DELETE' })
    fetchPubs()
  }

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">منشوراتي الطبية</h1>
            <p className="text-slate-400 text-sm mt-1">{pubs.length} منشور</p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium rounded-xl transition-all hover:from-emerald-400">
            + منشور جديد
          </button>
        </div>

        {msg && <div className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl">{msg}</div>}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : pubs.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">✍️</div>
            <p className="text-slate-400 mb-4">لم تنشر أي مقال بعد</p>
            <button onClick={() => setShowNew(true)} className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm">ابدأ الكتابة</button>
          </div>
        ) : (
          <div className="space-y-4">
            {pubs.map(pub => (
              <div key={pub.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${pub.status === 'PUBLISHED' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                      {pub.status === 'PUBLISHED' ? 'منشور' : 'مسودة'}
                    </span>
                    <span className="text-slate-500 text-xs">{pub.type === 'ARTICLE' ? 'مقال' : pub.type === 'RESEARCH' ? 'بحث' : pub.type}</span>
                  </div>
                  <h3 className="text-white font-medium text-sm truncate">{pub.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-slate-500 text-xs">
                    <span>👁 {pub.viewCount}</span>
                    <span>❤️ {pub.likeCount}</span>
                    <span>{new Date(pub.createdAt).toLocaleDateString('ar-SA')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {pub.status === 'PUBLISHED' && (
                    <Link href={`/publications/${pub.id}`} target="_blank"
                      className="p-2 text-slate-400 hover:text-white transition-colors text-sm">
                      👁
                    </Link>
                  )}
                  <button onClick={() => togglePublish(pub.id, pub.status === 'PUBLISHED')}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all
                      ${pub.status === 'PUBLISHED'
                        ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'}`}>
                    {pub.status === 'PUBLISHED' ? 'إخفاء' : 'نشر'}
                  </button>
                  <button onClick={() => deletePub(pub.id)}
                    className="p-1.5 text-red-400/50 hover:text-red-400 transition-colors text-sm">
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal إنشاء منشور */}
        {showNew && (
          <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 overflow-y-auto py-8 px-4">
            <div className="bg-slate-900 border border-white/[0.08] rounded-2xl p-6 w-full max-w-2xl" dir="rtl">
              <h3 className="text-white font-bold text-lg mb-5">منشور جديد</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm mb-2 block">النوع</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none">
                    {TYPE_OPTS.map(o => <option key={o.v} value={o.v} className="bg-slate-900">{o.l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 text-sm mb-2 block">العنوان *</label>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="عنوان المقال الطبي"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="text-slate-300 text-sm mb-2 block">ملخص قصير</label>
                  <textarea value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))}
                    rows={2} placeholder="ملخص يظهر في بطاقة المنشور..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none" />
                </div>
                <div>
                  <label className="text-slate-300 text-sm mb-2 block">المحتوى * (50 حرف على الأقل)</label>
                  <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                    rows={8} placeholder="اكتب محتوى المقال هنا..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none" />
                </div>
                <div>
                  <label className="text-slate-300 text-sm mb-2 block">الوسوم (مفصولة بفاصلة)</label>
                  <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                    placeholder="قلب، ضغط الدم، السكري"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div onClick={() => setForm(p => ({ ...p, publish: !p.publish }))}
                    className={`w-10 h-5 rounded-full transition-all relative ${form.publish ? 'bg-emerald-500' : 'bg-white/20'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.publish ? 'right-0.5' : 'left-0.5'}`} />
                  </div>
                  <span className="text-slate-300 text-sm">نشر فوراً</span>
                </label>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleCreate} disabled={saving || !form.title || form.content.length < 50}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all">
                  {saving ? 'جاري الحفظ...' : form.publish ? 'نشر المقال' : 'حفظ كمسودة'}
                </button>
                <button onClick={() => setShowNew(false)}
                  className="flex-1 py-3 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-sm">
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
