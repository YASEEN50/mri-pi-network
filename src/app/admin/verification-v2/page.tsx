'use client'
// src/app/admin/verification-v2/page.tsx
// قائمة طلبات التحقق v2 مرتبة حسب المخاطرة

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import Navbar from '@/components/common/Navbar'

interface SessionRow {
  sessionId:      string
  doctorName:     string
  specialization: string
  city:           string
  email:          string
  currentState:   string
  finalScore:     number | null
  riskLevel:      'HIGH' | 'MEDIUM' | 'LOW' | null
  documentsCount: number
  fraudFlagsCount: number
  hasLicense:     boolean
  hasSelfie:      boolean
  updatedAt:      string
  assignedToId:   string | null
  assigneeEmail:  string | null
  internalNotesCount: number
}

const RISK_COLORS: Record<string, string> = {
  HIGH:   '#ef4444',
  MEDIUM: '#f59e0b',
  LOW:    '#10b981',
}

export default function VerificationV2Page() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [rows,    setRows]    = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('PENDING_HUMAN')
  const [assignFilter, setAssignFilter] = useState('all')
  const [total,   setTotal]   = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/admin/verification-v2?status=${filter}&assign=${assignFilter}&limit=50`)
      const data = await res.json()
      setRows(data.data ?? [])
      setTotal(data.meta?.total ?? 0)
    } catch {}
    finally { setLoading(false) }
  }, [filter, assignFilter])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') {
      const role = (session?.user as any)?.role
      if (role !== 'ADMIN' && role !== 'OWNER') { router.push('/unauthorized'); return }
      void loadData()
    }
  }, [status, session, router, loadData])

  const FILTERS = [
    { key: 'PENDING_HUMAN',        label: '⏳ قيد المراجعة البشرية' },
    { key: 'FACE_SUBMITTED',       label: '🪪 وجه مُرسَل' },
    { key: 'CREDENTIALS_UPLOADED', label: '🎓 شهادات مرفوعة' },
    { key: 'LICENSE_UPLOADED',     label: '📋 رخصة مرفوعة' },
    { key: 'APPROVED',             label: '✅ مقبول' },
    { key: 'REJECTED',             label: '❌ مرفوض' },
  ]

  const ASSIGN_FILTERS = [
    { key: 'all',        label: 'الكل' },
    { key: 'mine',       label: '👤 مهامي' },
    { key: 'unassigned', label: '📥 غير مُسنَد' },
  ]

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">مراجعة التحقق من الأطباء</h1>
            <p className="text-slate-400 text-sm mt-1">نظام v2 — مرتب حسب درجة المخاطرة</p>
          </div>
          <div className="text-slate-400 text-sm">{total} طلب</div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: filter === f.key ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${filter === f.key ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: filter === f.key ? '#60a5fa' : '#94a3b8',
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {filter === 'PENDING_HUMAN' && (
          <div className="flex gap-2 mb-4">
            {ASSIGN_FILTERS.map(f => (
              <button key={f.key} onClick={() => setAssignFilter(f.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: assignFilter === f.key ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${assignFilter === f.key ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  color: assignFilter === f.key ? '#34d399' : '#94a3b8',
                }}>
                {f.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <div className="text-4xl mb-3">📭</div>
            <p>لا توجد طلبات في هذه الفئة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(row => (
              <div key={row.sessionId}
                onClick={() => router.push(`/admin/verification-v2/${row.sessionId}`)}
                className="rounded-xl p-4 cursor-pointer transition-all hover:border-blue-500/30"
                style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Risk Badge */}
                    <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                      style={{
                        background: `${RISK_COLORS[row.riskLevel ?? 'HIGH']}15`,
                        border: `1px solid ${RISK_COLORS[row.riskLevel ?? 'HIGH']}30`,
                      }}>
                      <span className="text-lg font-bold" style={{color: RISK_COLORS[row.riskLevel ?? 'HIGH']}}>
                        {row.finalScore ?? '?'}
                      </span>
                      <span className="text-xs" style={{color: RISK_COLORS[row.riskLevel ?? 'HIGH']}}>
                        {row.riskLevel === 'HIGH' ? 'عالي' : row.riskLevel === 'MEDIUM' ? 'متوسط' : 'منخفض'}
                      </span>
                    </div>

                    {/* Doctor Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">{row.doctorName}</span>
                        {row.fraudFlagsCount > 0 && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{background:'rgba(239,68,68,0.15)',color:'#f87171',border:'1px solid rgba(239,68,68,0.2)'}}>
                            ⚠️ {row.fraudFlagsCount} علامة احتيال
                          </span>
                        )}
                        {row.internalNotesCount > 0 && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{background:'rgba(59,130,246,0.12)',color:'#93c5fd',border:'1px solid rgba(59,130,246,0.2)'}}>
                            💬 {row.internalNotesCount}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 text-sm">{row.specialization} · {row.city}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{row.email}</div>
                      {row.assigneeEmail && (
                        <div className="text-emerald-400/80 text-xs mt-1">👤 {row.assigneeEmail}</div>
                      )}
                      {!row.assigneeEmail && filter === 'PENDING_HUMAN' && (
                        <div className="text-amber-400/70 text-xs mt-1">📥 غير مُسنَد</div>
                      )}
                    </div>
                  </div>

                  {/* Status & Docs */}
                  <div className="text-left space-y-1.5">
                    <div className="flex items-center gap-2 justify-end">
                      <span className={`text-xs px-2 py-0.5 rounded ${row.hasLicense ? 'text-accent' : 'text-red-400'}`}
                        style={{background: row.hasLicense ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}}>
                        {row.hasLicense ? '✅' : '❌'} رخصة
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${row.hasSelfie ? 'text-accent' : 'text-red-400'}`}
                        style={{background: row.hasSelfie ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}}>
                        {row.hasSelfie ? '✅' : '❌'} وجه
                      </span>
                    </div>
                    <div className="text-slate-500 text-xs text-left">
                      {new Date(row.updatedAt).toLocaleDateString('ar-SA')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
