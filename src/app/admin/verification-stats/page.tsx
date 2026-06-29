'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'

interface Stats {
  pendingHuman: number
  unassigned: number
  highRiskPending: number
  suspiciousDocs: number
  approvedWeek: number
  rejectedWeek: number
  avgPendingScore: number | null
  myAssigned: number
}

export default function VerificationStatsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (status === 'authenticated') {
      const role = (session?.user as { role?: string })?.role
      if (role !== 'ADMIN' && role !== 'OWNER') { router.replace('/unauthorized'); return }
      fetch('/api/admin/verification-stats')
        .then((r) => r.json())
        .then((d) => setStats(d.data ?? null))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [status, session, router])

  const cards = stats ? [
    { label: 'بانتظار المراجعة', value: stats.pendingHuman, icon: '⏳', href: '/admin/verification-v2?status=PENDING_HUMAN', color: '#f59e0b' },
    { label: 'غير مُسنَد', value: stats.unassigned, icon: '📥', href: '/admin/verification-v2?status=PENDING_HUMAN&assign=unassigned', color: '#f97316' },
    { label: 'مهامي', value: stats.myAssigned, icon: '👤', href: '/admin/verification-v2?status=PENDING_HUMAN&assign=mine', color: '#34d399' },
    { label: 'مخاطرة عالية', value: stats.highRiskPending, icon: '🚨', href: '/admin/verification-v2?status=PENDING_HUMAN', color: '#ef4444' },
    { label: 'مستندات مشبوهة', value: stats.suspiciousDocs, icon: '🔬', href: '/admin/suspicious-documents', color: '#dc2626' },
    { label: 'مقبول (7 أيام)', value: stats.approvedWeek, icon: '✅', href: '/admin/verification-v2?status=APPROVED', color: '#10b981' },
    { label: 'مرفوض (7 أيام)', value: stats.rejectedWeek, icon: '❌', href: '/admin/verification-v2?status=REJECTED', color: '#64748b' },
    { label: 'متوسط درجة المعلّق', value: stats.avgPendingScore ?? '—', icon: '📊', href: '/admin/verification-v2', color: '#6366f1' },
  ] : []

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">📊 إحصائيات التحقق</h1>
            <p className="text-slate-400 text-sm mt-1">نظرة سريعة على قائمة المراجعة</p>
          </div>
          <Link href="/admin/verification-v2" className="text-sm text-blue-400 hover:underline">
            ← التحقق v2
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {cards.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="rounded-2xl p-4 transition-all hover:scale-[1.02]"
                style={{ background: `${c.color}12`, border: `1px solid ${c.color}30` }}>
                <div className="text-2xl mb-2">{c.icon}</div>
                <div className="text-2xl font-bold text-white">{c.value}</div>
                <div className="text-xs mt-1" style={{ color: c.color }}>{c.label}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
