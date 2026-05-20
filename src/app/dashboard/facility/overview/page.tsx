'use client'
// src/app/dashboard/facility/overview/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'

interface Stats {
  totalDoctors:      number
  totalAppointments: number
  pendingAppointments: number
  completedAppointments: number
  averageRating:     number
  totalReviews:      number
}

export default function FacilityOverviewPage() {
  const { data: session, status } = useSession()
  const router  = useRouter()
  const [stats, setStats]     = useState<Stats | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [aptRes, docRes] = await Promise.all([
        fetch('/api/appointments?limit=100'),
        fetch('/api/facility/doctors'),
      ])
      const [aptData, docData] = await Promise.all([aptRes.json(), docRes.json()])

      const apts = aptData.data ?? []
      setStats({
        totalDoctors:          (docData.data ?? []).length,
        totalAppointments:     apts.length,
        pendingAppointments:   apts.filter((a: any) => a.status === 'PENDING').length,
        completedAppointments: apts.filter((a: any) => a.status === 'COMPLETED').length,
        averageRating:         0,
        totalReviews:          0,
      })
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && session.user.role !== 'FACILITY') { router.push('/unauthorized'); return }
    void fetchData()
  }, [session, status, router, fetchData])

  const statCards = stats ? [
    { label: 'الأطباء',          value: stats.totalDoctors,          icon: '👨‍⚕️', color: 'text-blue-400' },
    { label: 'إجمالي المواعيد',  value: stats.totalAppointments,     icon: '📅', color: 'text-emerald-400' },
    { label: 'مواعيد معلقة',     value: stats.pendingAppointments,   icon: '⏳', color: 'text-amber-400' },
    { label: 'مواعيد مكتملة',    value: stats.completedAppointments, icon: '✅', color: 'text-teal-400' },
  ] : []

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">لوحة تحكم المنشأة</h1>
          <p className="text-slate-400 text-sm mt-1">نظرة عامة على نشاط منشأتك</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* إحصائيات */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {statCards.map(s => (
                <div key={s.label} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-slate-400 text-sm mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* روابط سريعة */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/dashboard/facility/doctors"
                className="bg-white/[0.03] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 flex items-center gap-4 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  👨‍⚕️
                </div>
                <div>
                  <p className="text-white font-medium">إدارة الأطباء</p>
                  <p className="text-slate-400 text-sm">عرض وإدارة الأطباء التابعين</p>
                </div>
              </Link>

              <Link href="/appointments"
                className="bg-white/[0.03] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 flex items-center gap-4 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  📅
                </div>
                <div>
                  <p className="text-white font-medium">المواعيد</p>
                  <p className="text-slate-400 text-sm">إدارة مواعيد المرضى</p>
                </div>
              </Link>

              <Link href="/profile"
                className="bg-white/[0.03] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 flex items-center gap-4 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🏥
                </div>
                <div>
                  <p className="text-white font-medium">ملف المنشأة</p>
                  <p className="text-slate-400 text-sm">تعديل معلومات المنشأة</p>
                </div>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
