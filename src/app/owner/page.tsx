'use client'
// src/app/owner/page.tsx
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'

interface Stats {
  totalUsers: number; totalDoctors: number; totalClients: number
  totalFacilities: number; pendingDoctors: number; pendingFacilities: number
  pendingPublications: number
  totalAppointments: number; completedAppointments: number; totalReviews: number
}

export default function OwnerDashboard() {
  const { data: session, status } = useSession()
  const router  = useRouter()
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [time,    setTime]    = useState(new Date())

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'OWNER') { router.push('/unauthorized'); return }
    if (status === 'authenticated') {
      fetch('/api/admin/stats').then(r => r.json()).then(d => setStats(d.data)).finally(() => setLoading(false))
    }
  }, [status, session, router])

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  if (status === 'loading' || loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
        <p className="text-slate-500 text-sm">جاري تحميل لوحة التحكم...</p>
      </div>
    </div>
  )

  const completionRate = stats && stats.totalAppointments > 0
    ? Math.round((stats.completedAppointments / stats.totalAppointments) * 100) : 0
  const pendingTotal = (stats?.pendingDoctors ?? 0) + (stats?.pendingFacilities ?? 0)
  const pendingPublications = stats?.pendingPublications ?? 0
  const reviewTotal = pendingTotal + pendingPublications
  const doctorApprovalRate = stats?.totalDoctors
    ? Math.round(((stats.totalDoctors - stats.pendingDoctors) / stats.totalDoctors) * 100) : 0

  const statCards = [
    { label: 'المستخدمون', value: stats?.totalUsers ?? 0,             icon: '👥', clr: '#6366f1', sub: `${stats?.totalClients ?? 0} مريض`, href: null },
    { label: 'الأطباء',    value: stats?.totalDoctors ?? 0,           icon: '👨‍⚕️', clr: '#10b981', sub: `${stats?.pendingDoctors ?? 0} معلق`, href: '/dashboard/admin/pending' },
    { label: 'المنشآت',    value: stats?.totalFacilities ?? 0,        icon: '🏥', clr: '#3b82f6', sub: `${stats?.pendingFacilities ?? 0} معلق`, href: '/dashboard/admin/pending' },
    { label: 'المواعيد',   value: stats?.totalAppointments ?? 0,      icon: '📅', clr: '#f59e0b', sub: `${completionRate}% مكتمل`, href: null },
    { label: 'المكتملة',   value: stats?.completedAppointments ?? 0,  icon: '✅', clr: '#14b8a6', sub: 'موعد ناجح', href: null },
    { label: 'التقييمات',  value: stats?.totalReviews ?? 0,           icon: '⭐', clr: '#f97316', sub: 'تقييم مريض', href: null },
  ]

  const quickActions = [
    { href: '/admin/publications',      icon: '📝', label: 'مراجعة المنشورات', desc: pendingPublications > 0 ? `${pendingPublications} بانتظار المراجعة` : 'مقالات الأطباء', clr: '#fb923c' },
    { href: '/owner/moderation',       icon: '🔎', label: 'مراقبة المحتوى', desc: 'تقارير المخالفات',    clr: '#f43f5e' },
    { href: '/owner/ads',               icon: '📢', label: 'الإعلانات',        desc: 'أسعار ومراجعة',      clr: '#fbbf24' },
    { href: '/owner/withdrawals',       icon: '💸', label: 'سحب الأطباء',     desc: 'تحويل π للأطباء',    clr: '#34d399' },
    { href: '/owner/premio-settings',   icon: '💎', label: 'البريميو',          desc: 'أسعار الاشتراكات',   clr: '#a78bfa' },
    { href: '/owner/give-premio',       icon: '🎁', label: 'منح مجاني',        desc: 'مكافأة مستخدم',      clr: '#34d399' },
    { href: '/owner/assign-admin',      icon: '🛡️', label: 'المديرين',         desc: 'صلاحيات الفريق',     clr: '#60a5fa' },
    { href: '/dashboard/admin/pending', icon: '⏳', label: 'الطلبات',          desc: `${pendingTotal} معلق`, clr: '#fbbf24' },
    { href: '/admin/verification-v2',      icon: '🔍', label: 'التحقق',           desc: 'مراجعة الوثائق',     clr: '#f87171' },
    { href: '/owner/risk-config',        icon: '⚡', label: 'محرك المخاطر',     desc: 'أوزان التحقق',        clr: '#f59e0b' },
    { href: '/admin',                   icon: '⚙️', label: 'الإدارة',          desc: 'لوحة الأدمن',        clr: '#818cf8' },
    { href: '/doctors',                 icon: '🩺', label: 'الأطباء',          desc: 'عرض وإدارة',         clr: '#2dd4bf' },
    { href: '/publications',            icon: '📝', label: 'المنشورات',        desc: 'المقالات العلمية',   clr: '#fb923c' },
  ]

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-primary/15 border border-primary/25">
              👑
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">لوحة التحكم الرئيسية</h1>
              <p className="text-slate-400 text-sm">{session?.user?.email}</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono bg-primary/10 border border-primary/20 text-accent">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse inline-block" />
            {time.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
          </div>
        </div>

        {/* إحصاء - 6 بطاقات */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {statCards.map(c => {
            const inner = (
              <>
                <div className="text-2xl mb-3">{c.icon}</div>
                <p className="text-2xl font-bold text-white">{c.value.toLocaleString('ar-SA')}</p>
                <p className="text-xs font-semibold mt-0.5 mb-1" style={{color:c.clr}}>{c.label}</p>
                <p className="text-xs text-slate-500">{c.sub}</p>
              </>
            )
            const cls = `rounded-2xl p-4 transition-all hover:scale-[1.02] ${c.href ? 'cursor-pointer' : 'cursor-default'}`
            const style = { background: `${c.clr}12`, border: `1px solid ${c.clr}28` }
            return c.href ? (
              <Link key={c.label} href={c.href} className={cls} style={style}>{inner}</Link>
            ) : (
              <div key={c.label} className={cls} style={style}>{inner}</div>
            )
          })}
        </div>

        {/* Progress Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label:'نسبة إكمال المواعيد', pct: completionRate,       clr:'#10b981', sub:`${stats?.completedAppointments ?? 0} من ${stats?.totalAppointments ?? 0}` },
            { label:'الأطباء المعتمدون',   pct: doctorApprovalRate,   clr:'#6366f1', sub:`${(stats?.totalDoctors ?? 0) - (stats?.pendingDoctors ?? 0)} معتمد` },
            { label:'نشاط المنصة',         pct: Math.min(100, (stats?.totalAppointments ?? 0) / 5), clr:'#f59e0b', sub:'بناءً على المواعيد' },
          ].map(bar => (
            <div key={bar.label} className="rounded-2xl p-5 mpi-card">
              <div className="flex justify-between items-baseline mb-2">
                <p className="text-slate-400 text-xs">{bar.label}</p>
                <p className="text-white font-bold text-lg">{Math.round(bar.pct)}%</p>
              </div>
              <div className="h-2 rounded-full mb-2 bg-white/10">
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{width:`${Math.round(bar.pct)}%`,background:`linear-gradient(90deg,${bar.clr},${bar.clr}88)`}} />
              </div>
              <p className="text-slate-500 text-xs">{bar.sub}</p>
            </div>
          ))}
        </div>

        {/* تنبيه الطلبات المعلقة */}
        {reviewTotal > 0 && (
          <div className="rounded-2xl p-4 mb-6 flex items-center justify-between bg-warning/10 border border-warning/20">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-amber-300 font-medium text-sm">يوجد {reviewTotal} عنصر بانتظار مراجعتك</p>
                <p className="text-amber-400/60 text-xs">
                  {stats?.pendingDoctors} طبيب · {stats?.pendingFacilities} منشأة
                  {pendingPublications > 0 ? ` · ${pendingPublications} منشور` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {pendingPublications > 0 && (
                <Link href="/admin/publications"
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  مراجعة المنشورات
                </Link>
              )}
              {pendingTotal > 0 && (
                <Link href="/dashboard/admin/pending"
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 bg-warning/25 text-warning border border-warning/30">
                  الطلبات المعلقة
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* الإجراءات السريعة */}
          <div className="lg:col-span-2">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm">
              <span className="w-1 h-4 rounded-full bg-primary inline-block" />
              الإجراءات السريعة
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map(a => (
                <Link key={a.href} href={a.href}
                  className="rounded-2xl p-4 flex flex-col gap-3 transition-all hover:scale-[1.03] group mpi-card">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all group-hover:scale-110"
                    style={{background:`${a.clr}15`,border:`1px solid ${a.clr}30`}}>
                    {a.icon}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium group-hover:text-accent transition-colors">{a.label}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{a.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* إدارة النظام */}
          <div>
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm">
              <span className="w-1 h-4 rounded-full bg-primary inline-block" />
              إدارة النظام
            </h2>
            <div className="rounded-2xl overflow-hidden mpi-card">
              {[
                { href:'/admin/verification-v2',   icon:'🔍', label:'التحقق من الأطباء',  badge: stats?.pendingDoctors ?? 0 },
                { href:'/admin/publications',      icon:'📝', label:'مراجعة المنشورات', badge: pendingPublications },
                { href:'/owner/moderation',        icon:'🔎', label:'مراقبة المحتوى',     badge: 0 },
                { href:'/dashboard/admin/pending', icon:'⏳', label:'الطلبات المعلقة',    badge: pendingTotal },
                { href:'/owner/assign-admin',      icon:'🛡️', label:'إدارة الفريق',       badge: 0 },
                { href:'/owner/premio-settings',   icon:'💎', label:'إعدادات الاشتراكات', badge: 0 },
                { href:'/owner/give-premio',       icon:'🎁', label:'منح بريميو مجاني',   badge: 0 },
                { href:'/publications',            icon:'📰', label:'المنشورات الطبية',   badge: 0 },
              ].map((item, i) => (
                <Link key={item.href} href={item.href}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-all group ${i > 0 ? 'border-t border-white/5' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{item.icon}</span>
                    <span className="text-slate-300 text-sm group-hover:text-white transition-colors">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.badge > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning">
                        {item.badge}
                      </span>
                    )}
                    <span className="text-slate-600 group-hover:text-slate-400 text-xs">←</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
