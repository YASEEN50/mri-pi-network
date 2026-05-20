'use client'
// src/app/admin/fraud-events/page.tsx
// لوحة مراقبة أحداث الاحتيال للأدمن

import { useState, useEffect, useCallback } from 'react'
import { useSession }  from 'next-auth/react'
import { useRouter }   from 'next/navigation'
import Navbar          from '@/components/common/Navbar'
import Link            from 'next/link'

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  MULTI_ACCOUNT_DEVICE:    { label: 'جهاز متعدد الحسابات', icon: '📱', color: '#ef4444' },
  HIGH_FREQUENCY_ATTEMPT:  { label: 'محاولات متكررة',       icon: '⚡', color: '#f97316' },
  AUTOMATION_SUSPECTED:    { label: 'سلوك آلي',              icon: '🤖', color: '#a855f7' },
  SHARED_DEVICE:           { label: 'جهاز مشترك',            icon: '🔗', color: '#f59e0b' },
  IP_FLOOD:                { label: 'Flood من IP',            icon: '🌊', color: '#ef4444' },
  RAPID_RESUBMISSION:      { label: 'إعادة تقديم سريعة',    icon: '🔄', color: '#f97316' },
  SUSPICIOUS_UA:           { label: 'User-Agent مشبوه',      icon: '🕵️', color: '#64748b' },
}

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 text-red-300 border-red-500/30',
  HIGH:     'bg-orange-500/20 text-orange-300 border-orange-500/30',
  MEDIUM:   'bg-amber-500/20 text-amber-300 border-amber-500/30',
  LOW:      'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

interface FraudEvent {
  id: string; type: string; userId: string; sessionId?: string
  ipAddress?: string; deviceId?: string; severity: string
  resolved: boolean; metadata: any; createdAt: string
}

export default function FraudEventsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [events,   setEvents]   = useState<FraudEvent[]>([])
  const [stats,    setStats]    = useState<{ type: string; count: number }[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState({ type: '', severity: '', resolved: 'false' })
  const [resolving, setResolving] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') {
      const role = (session?.user as any)?.role
      if (role !== 'ADMIN' && role !== 'OWNER') { router.push('/unauthorized'); return }
    }
  }, [status, session, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '50',
        resolved: filter.resolved,
        ...(filter.type     && { type: filter.type }),
        ...(filter.severity && { severity: filter.severity }),
      })
      const res  = await fetch(`/api/admin/fraud-events?${params}`)
      const data = await res.json()
      setEvents(data.data?.events ?? [])
      setStats(data.data?.stats   ?? [])
      setTotal(data.meta?.total   ?? 0)
    } catch {}
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function resolveEvent(id: string) {
    setResolving(id)
    try {
      await fetch('/api/admin/fraud-events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setEvents(prev => prev.filter(e => e.id !== id))
      setTotal(t => t - 1)
    } catch {}
    finally { setResolving(null) }
  }

  const unresolvedBySeverity = SEVERITY_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = events.filter(e => e.severity === s).length
    return acc
  }, {})

  return (
    <div className="min-h-screen" style={{ background: '#080c14' }} dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/admin" className="text-slate-500 hover:text-white text-sm">← الإدارة</Link>
            </div>
            <h1 className="text-2xl font-bold text-white">🚨 أحداث الاحتيال</h1>
            <p className="text-slate-400 text-sm mt-1">{total} حدث غير محلول</p>
          </div>
          <button onClick={load} disabled={loading}
            className="px-4 py-2 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}>
            {loading ? '...' : '↺ تحديث'}
          </button>
        </div>

        {/* Stats by type */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {stats.slice(0, 4).map(s => {
              const meta = TYPE_META[s.type]
              return (
                <button key={s.type}
                  onClick={() => setFilter(f => ({ ...f, type: f.type === s.type ? '' : s.type }))}
                  className="rounded-xl p-3 text-right transition-all"
                  style={{
                    background: filter.type === s.type ? `${meta?.color ?? '#64748b'}20` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${filter.type === s.type ? (meta?.color ?? '#64748b') + '40' : 'rgba(255,255,255,0.07)'}`,
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg">{meta?.icon ?? '⚠️'}</span>
                    <span className="text-xl font-bold text-white">{s.count}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-tight">{meta?.label ?? s.type}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* Severity summary */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {SEVERITY_ORDER.filter(s => unresolvedBySeverity[s] > 0).map(s => (
            <button key={s}
              onClick={() => setFilter(f => ({ ...f, severity: f.severity === s ? '' : s }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${SEVERITY_STYLE[s]}`}
              style={{ opacity: filter.severity && filter.severity !== s ? 0.4 : 1 }}>
              {s} ({unresolvedBySeverity[s]})
            </button>
          ))}
          {/* Show resolved toggle */}
          <button
            onClick={() => setFilter(f => ({ ...f, resolved: f.resolved === 'false' ? 'true' : 'false' }))}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all mr-auto"
            style={{
              background: filter.resolved === 'true' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: filter.resolved === 'true' ? '#34d399' : '#64748b',
            }}>
            {filter.resolved === 'true' ? '✅ المحلولة' : '⏳ غير المحلولة'}
          </button>
        </div>

        {/* Events list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <div className="text-4xl mb-3">🛡️</div>
            <p>لا توجد أحداث في هذه الفئة</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map(ev => {
              const meta = TYPE_META[ev.type]
              return (
                <div key={ev.id} className="rounded-xl p-4 transition-all"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-xl flex-shrink-0 mt-0.5">{meta?.icon ?? '⚠️'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-white font-medium text-sm">{meta?.label ?? ev.type}</span>
                          <span className={`text-xs px-2 py-0.5 rounded border ${SEVERITY_STYLE[ev.severity]}`}>
                            {ev.severity}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          {ev.userId    && <span>👤 {ev.userId.slice(0, 8)}...</span>}
                          {ev.ipAddress && <span>🌐 {ev.ipAddress}</span>}
                          {ev.deviceId  && <span>📱 {ev.deviceId.slice(0, 12)}...</span>}
                          {ev.sessionId && (
                            <Link href={`/admin/verification-v2/${ev.sessionId}`}
                              className="text-blue-400 hover:text-blue-300 transition-colors">
                              🔍 فتح الجلسة
                            </Link>
                          )}
                          <span>{new Date(ev.createdAt).toLocaleString('ar-SA')}</span>
                        </div>

                        {/* Metadata */}
                        {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {Object.entries(ev.metadata as Record<string, unknown>).map(([k, v]) => (
                              <span key={k} className="text-xs px-2 py-0.5 rounded font-mono"
                                style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                                {k}: {String(v)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {!ev.resolved && (
                      <button onClick={() => resolveEvent(ev.id)}
                        disabled={resolving === ev.id}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                        style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                        {resolving === ev.id ? '...' : '✓ حلّ'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
