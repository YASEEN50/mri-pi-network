'use client'
// src/app/admin/publications/page.tsx

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'
import DashboardBreadcrumb from '@/components/admin/DashboardBreadcrumb'

interface PendingPub {
  id: string
  title: string
  summary?: string
  content?: string
  type: string
  tags: string[]
  createdAt: string
  doctor?: { id: string; name: string; specialization?: string; email?: string }
}

const TYPE_LABELS: Record<string, string> = {
  ARTICLE: 'مقال', RESEARCH: 'بحث', CASE_STUDY: 'دراسة حالة', ANNOUNCEMENT: 'إعلان',
}

export default function AdminPublicationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [pubs, setPubs] = useState<PendingPub[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [submitting, setSubmitting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const res = await fetch('/api/admin/publications/pending', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data.success) {
        setPubs(data.data ?? [])
        return
      }
      setLoadError(data?.error?.message ?? 'تعذّر تحميل قائمة المنشورات')
    } catch {
      setLoadError('خطأ في الاتصال — أعد تحميل الصفحة')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && !['ADMIN', 'OWNER'].includes(session.user.role)) { router.push('/'); return }
    if (session) void load()
  }, [session, status, router, load])

  async function review(id: string, action: 'approve' | 'reject', notes?: string) {
    setSubmitting(id)
    try {
      const res = await fetch(`/api/admin/publications/${id}/review`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action, notes }),
      })
      const data = await res.json()
      if (data.success) {
        setPubs(p => p.filter(x => x.id !== id))
        setRejectId(null)
        setRejectNotes('')
      }
    } finally { setSubmitting(null) }
  }

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <DashboardBreadcrumb items={[{ label: 'مراجعة المنشورات' }]} className="mb-4" />
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <Link href="/admin"
            className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-xl text-sm transition-all">
            ← لوحة الإدارة
          </Link>
          {session?.user?.role === 'OWNER' && (
            <Link href="/owner"
              className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-xl text-sm transition-all">
              ← لوحة المالك
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">مراجعة المنشورات 📝</h1>
            <p className="text-slate-400 text-sm mt-1">{pubs.length} منشور بانتظار الموافقة</p>
          </div>
        </div>

        {loadError && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : pubs.length === 0 ? (
          <div className="text-center py-20 mpi-card rounded-2xl">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-slate-400">لا توجد منشورات بانتظار المراجعة</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pubs.map(pub => (
              <div key={pub.id} className="mpi-card rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        قيد المراجعة
                      </span>
                      <span className="text-slate-500 text-xs">{TYPE_LABELS[pub.type] ?? pub.type}</span>
                    </div>
                    <h3 className="text-white font-semibold">{pub.title}</h3>
                    {pub.doctor && (
                      <p className="text-slate-400 text-xs mt-1">
                        {pub.doctor.name}
                        {pub.doctor.specialization && ` · ${pub.doctor.specialization}`}
                      </p>
                    )}
                    {pub.summary && <p className="text-slate-400 text-sm mt-2">{pub.summary}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setExpanded(expanded === pub.id ? null : pub.id)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-300 hover:bg-white/5">
                      {expanded === pub.id ? 'إخفاء' : 'عرض المحتوى'}
                    </button>
                    <button
                      onClick={() => review(pub.id, 'approve')}
                      disabled={submitting === pub.id}
                      className="px-4 py-1.5 text-xs rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50">
                      ✅ موافقة
                    </button>
                    <button
                      onClick={() => setRejectId(rejectId === pub.id ? null : pub.id)}
                      disabled={submitting === pub.id}
                      className="px-4 py-1.5 text-xs rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-50">
                      ❌ رفض
                    </button>
                  </div>
                </div>

                {expanded === pub.id && pub.content && (
                  <div className="mt-3 p-4 rounded-xl bg-white/[0.03] border border-white/5 text-slate-300 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {pub.content}
                  </div>
                )}

                {rejectId === pub.id && (
                  <div className="mt-4 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                    <label className="text-slate-300 text-xs block mb-2">سبب الرفض (اختياري)</label>
                    <textarea
                      value={rejectNotes}
                      onChange={e => setRejectNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3 resize-none"
                    />
                    <button
                      onClick={() => review(pub.id, 'reject', rejectNotes)}
                      disabled={submitting === pub.id}
                      className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium disabled:opacity-50">
                      تأكيد الرفض
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
