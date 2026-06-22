'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'

interface Stats {
  totalUsers: number
  totalDoctors: number
  totalClients: number
  totalFacilities: number
  pendingDoctors: number
  pendingFacilities: number
  totalAppointments: number
  completedAppointments: number
  totalReviews: number
}

export default function AdminStatsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && !['ADMIN', 'OWNER'].includes(session.user.role)) {
      router.push('/unauthorized')
      return
    }
    if (!session) return

    fetch('/api/admin/stats')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d?.message ?? 'فشل تحميل الإحصائيات')
        setStats(d.data)
      })
      .catch(e => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [session, status, router])

  const cards = stats
    ? [
        { label: 'إجمالي المستخدمين', value: stats.totalUsers, color: 'text-slate-300' },
        { label: 'الأطباء', value: stats.totalDoctors, color: 'text-emerald-400' },
        { label: 'العملاء', value: stats.totalClients, color: 'text-pink-400' },
        { label: 'المنشآت', value: stats.totalFacilities, color: 'text-blue-400' },
        { label: 'أطباء بانتظار الموافقة', value: stats.pendingDoctors, color: 'text-amber-400' },
        { label: 'منشآت بانتظار الموافقة', value: stats.pendingFacilities, color: 'text-amber-400' },
        { label: 'إجمالي المواعيد', value: stats.totalAppointments, color: 'text-purple-400' },
        { label: 'مواعيد مكتملة', value: stats.completedAppointments, color: 'text-teal-400' },
        { label: 'التقييمات', value: stats.totalReviews, color: 'text-yellow-400' },
      ]
    : []

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">إحصائيات المنصة</h1>
            <p className="text-slate-400 text-sm mt-1">بيانات مباشرة من /api/admin/stats</p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm"
          >
            ← لوحة الإدارة
          </Link>
        </div>

        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-400">{error}</div>
        )}

        {!isLoading && !error && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {cards.map(c => (
              <div
                key={c.label}
                className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5"
              >
                <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-slate-400 text-sm mt-2">{c.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
