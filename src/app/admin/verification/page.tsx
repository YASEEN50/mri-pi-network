'use client'
// src/app/admin/verification/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'

interface QueueItem {
  queueId:             string
  sessionId?:          string
  verificationId:      string
  priority:            number
  queueStatus:         string
  createdAt:           string
  doctorName:          string
  specialization:      string
  city:                string
  email:               string
  overallConfidence:   number | null
  faceMatchConfidence: number | null
  certificate:         { aiConfidence: number; nameMatchStatus: string } | null
}

function ConfidenceBadge({ value }: { value: number | null }) {
  if (!value) return <span className="text-slate-500 text-xs">--</span>
  const color = value >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : value >= 60 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              : 'text-red-400 bg-red-500/10 border-red-500/20'
  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${color}`}>
      {value}%
    </span>
  )
}

function PriorityBadge({ priority }: { priority: number }) {
  const label = priority <= 3 ? 'عالية' : priority <= 6 ? 'متوسطة' : 'منخفضة'
  const color = priority <= 3 ? 'text-red-400 bg-red-500/10 border-red-500/20'
              : priority <= 6 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              : 'text-slate-400 bg-slate-500/10 border-slate-500/20'
  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs ${color}`}>{label}</span>
  )
}

export default function AdminVerificationPage() {
  const { data: session, status } = useSession()
  const router  = useRouter()
  const [items,     setItems]     = useState<QueueItem[]>([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [qStatus,   setQStatus]   = useState('WAITING')
  const [isLoading, setIsLoading] = useState(true)
  const [stats,     setStats]     = useState<any>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res  = await fetch(`/api/admin/verification?page=${page}&limit=15&status=${qStatus}`)
      const data = await res.json()
      setItems(data.data ?? [])
      setTotal(data.meta?.total ?? 0)
    } catch {}
    finally { setIsLoading(false) }
  }, [page, qStatus])

  const fetchStats = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/verification-stats')
      const data = await res.json()
      setStats(data.data)
    } catch {}
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && !['ADMIN', 'OWNER'].includes(session.user.role)) { router.push('/unauthorized'); return }
    void fetchData()
    void fetchStats()
  }, [session, status, router, fetchData, fetchStats])

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">مراجعة التحقق من الأطباء</h1>
            <p className="text-slate-400 text-sm mt-1">قائمة الانتظار البشرية</p>
          </div>
          <Link href="/admin/settings"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
            ⚙️ الإعدادات
          </Link>
        </div>

        {/* إحصائيات سريعة */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'في الانتظار',    value: stats.queueWaiting,       color: 'text-amber-400' },
              { label: 'موثّق هذا الشهر', value: stats.verifiedCount,      color: 'text-emerald-400' },
              { label: 'نسبة القبول',     value: `${stats.acceptanceRate}%`, color: 'text-blue-400' },
              { label: 'متوسط الثقة',     value: `${stats.avgConfidence}%`,  color: 'text-violet-400' },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-slate-400 text-sm mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* فلاتر */}
        <div className="flex gap-2 mb-5">
          {['WAITING', 'IN_REVIEW', 'COMPLETED'].map(s => (
            <button key={s} onClick={() => { setQStatus(s); setPage(1) }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border
                ${qStatus === s
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
              {s === 'WAITING' ? '⏳ انتظار' : s === 'IN_REVIEW' ? '🔍 قيد المراجعة' : '✅ مكتمل'}
            </button>
          ))}
          <span className="mr-auto text-slate-500 text-sm self-center">{total} طلب</span>
        </div>

        {/* الجدول */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 text-slate-400">لا توجد طلبات</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  {['الطبيب', 'التخصص', 'الأولوية', 'ثقة AI', 'تطابق الوجه', 'التاريخ', ''].map(h => (
                    <th key={h} className="text-right text-slate-400 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.queueId} className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{item.doctorName}</p>
                      <p className="text-slate-500 text-xs">{item.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{item.specialization}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={item.priority} /></td>
                    <td className="px-4 py-3"><ConfidenceBadge value={item.certificate?.aiConfidence ?? null} /></td>
                    <td className="px-4 py-3"><ConfidenceBadge value={item.faceMatchConfidence} /></td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(item.createdAt).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/verification-v2/${item.sessionId ?? item.verificationId}`}
                        className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium transition-all">
                        مراجعة
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > 15 && (
          <div className="flex justify-center gap-2 mt-6">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-sm disabled:opacity-40">
              ←
            </button>
            <span className="px-4 py-2 text-slate-400 text-sm">{page} / {Math.ceil(total / 15)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 15)}
              className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-sm disabled:opacity-40">
              →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
