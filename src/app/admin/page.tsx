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
  pendingDoctors: number
  pendingFacilities: number
  pendingPublications: number
  totalAppointments: number
  completedAppointments: number
  totalReviews: number
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'OWNER') { router.push('/'); return }
    if (session) {
      fetch('/api/admin/stats')
        .then(r => r.json())
        .then(d => setStats(d.data))
        .finally(() => setIsLoading(false))
    }
  }, [session, status, router])

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  const cards = [
    { title: 'إجمالي المستخدمين', value: stats?.totalUsers ?? 0, icon: '👥', color: 'border-slate-500/30 bg-slate-500/10', textColor: 'text-slate-300', link: '#' },
    { title: 'إجمالي الأطباء', value: stats?.totalDoctors ?? 0, icon: '👨‍⚕️', color: 'border-emerald-500/30 bg-emerald-500/10', textColor: 'text-emerald-400', link: '/admin/doctors' },
    { title: 'أطباء بانتظار الموافقة', value: stats?.pendingDoctors ?? 0, icon: '⏳', color: 'border-amber-500/30 bg-amber-500/10', textColor: 'text-amber-400', link: '/dashboard/admin/pending', urgent: (stats?.pendingDoctors ?? 0) > 0 },
    { title: 'منشآت بانتظار الموافقة', value: stats?.pendingFacilities ?? 0, icon: '🏥', color: 'border-blue-500/30 bg-blue-500/10', textColor: 'text-blue-400', link: '/dashboard/admin/verification', urgent: (stats?.pendingFacilities ?? 0) > 0 },
    { title: 'منشورات بانتظار المراجعة', value: stats?.pendingPublications ?? 0, icon: '📝', color: 'border-orange-500/30 bg-orange-500/10', textColor: 'text-orange-400', link: '/admin/publications', urgent: (stats?.pendingPublications ?? 0) > 0 },
    { title: 'إجمالي المواعيد', value: stats?.totalAppointments ?? 0, icon: '📅', color: 'border-purple-500/30 bg-purple-500/10', textColor: 'text-purple-400', link: '#' },
    { title: 'مواعيد مكتملة', value: stats?.completedAppointments ?? 0, icon: '✅', color: 'border-teal-500/30 bg-teal-500/10', textColor: 'text-teal-400', link: '#' },
    { title: 'إجمالي التقييمات', value: stats?.totalReviews ?? 0, icon: '⭐', color: 'border-yellow-500/30 bg-yellow-500/10', textColor: 'text-yellow-400', link: '#' },
    { title: 'إجمالي العملاء', value: stats?.totalClients ?? 0, icon: '🙋', color: 'border-pink-500/30 bg-pink-500/10', textColor: 'text-pink-400', link: '#' },
  ]

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">لوحة تحكم الإدارة</h1>
          <p className="text-slate-400 mt-1">مرحباً، {session?.user?.email}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {cards.map((card) => (
            <Link key={card.title} href={card.link}
              className={`relative p-5 rounded-2xl border ${card.color} hover:scale-[1.02] transition-all`}>
              {card.urgent && (
                <span className="absolute top-2 left-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              )}
              <div className="text-3xl mb-2">{card.icon}</div>
              <p className={`text-2xl font-bold ${card.textColor}`}>{card.value}</p>
              <p className="text-slate-400 text-xs mt-1">{card.title}</p>
            </Link>
          ))}
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">الإجراءات السريعة</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'مراجعة المنشورات', icon: '📝', href: '/admin/publications' },
              { label: 'مراجعة الأطباء', icon: '👨‍⚕️', href: '/dashboard/admin/pending' },
              { label: 'التحقق من الأطباء', icon: '🔐', href: '/admin/verification-v2' },
              { label: 'أحداث الاحتيال',     icon: '🚨', href: '/admin/fraud-events' },
              { label: 'مستندات مشبوهة',     icon: '🔬', href: '/admin/suspicious-documents' },
              { label: 'Intelligence',           icon: '🔭', href: '/admin/intelligence' },
              { label: 'مراجعة المنشآت', icon: '🏥', href: '/dashboard/admin/verification' },
              { label: 'الصفحة الرئيسية', icon: '🏠', href: '/' },
            ].map((action) => (
              <Link key={action.label} href={action.href}
                className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all">
                <span className="text-2xl">{action.icon}</span>
                <span className="text-sm text-slate-300">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
