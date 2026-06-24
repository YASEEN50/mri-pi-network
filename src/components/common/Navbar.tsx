'use client'
// src/components/common/Navbar.tsx

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Role } from '@prisma/client'
import SearchBar from '@/components/common/SearchBar'
import NotificationBell from '@/components/NotificationBell'
import { performLogout } from '@/lib/auth-logout'
import { cn } from '@/lib/cn'

interface NavbarProps {
  locale: 'ar' | 'en'
}

function getDashboardLink(role?: Role) {
  switch (role) {
    case Role.OWNER:    return '/owner'
    case Role.ADMIN:    return '/dashboard/admin/verification'
    case Role.DOCTOR:   return '/dashboard/doctor/schedule'
    case Role.FACILITY: return '/dashboard/facility/doctors'
    case Role.CLIENT:   return '/dashboard/client/appointments'
    default:            return '/dashboard'
  }
}

function getRoleNavLinks(role: Role | undefined, locale: 'ar' | 'en', t: (k: string) => string) {
  if (!role || role === Role.CLIENT) {
    return [
      { href: '/',             label: t('nav.home') },
      { href: '/doctors',      label: t('nav.doctors') },
      { href: '/facilities',   label: t('nav.facilities') },
      { href: '/publications', label: locale === 'ar' ? 'المنشورات' : 'Publications' },
      { href: '/appointments', label: locale === 'ar' ? 'مواعيدي' : 'My Appointments' },
    ]
  }
  if (role === Role.DOCTOR) {
    return [
      { href: '/dashboard/doctor/schedule', label: locale === 'ar' ? 'جدولي' : 'Schedule' },
      { href: '/dashboard/doctor/chat',     label: locale === 'ar' ? 'المحادثات' : 'Chat' },
      { href: '/doctors',                   label: t('nav.doctors') },
    ]
  }
  if (role === Role.FACILITY) {
    return [
      { href: '/dashboard/facility/overview', label: locale === 'ar' ? 'لوحة المنشأة' : 'Overview' },
      { href: '/dashboard/facility/doctors',  label: locale === 'ar' ? 'الأطباء' : 'Doctors' },
      { href: '/facilities',                  label: t('nav.facilities') },
    ]
  }
  if (role === Role.ADMIN || role === Role.OWNER) {
    return [
      { href: getDashboardLink(role),     label: role === Role.OWNER ? (locale === 'ar' ? 'لوحة المالك' : 'Owner') : (locale === 'ar' ? 'لوحة التحكم' : 'Dashboard') },
      { href: '/dashboard/admin/pending', label: locale === 'ar' ? 'الطلبات المعلقة' : 'Pending' },
      { href: '/admin/verification-v2',   label: 'التحقق v2' },
    ]
  }
  return [
    { href: '/',           label: t('nav.home') },
    { href: '/doctors',    label: t('nav.doctors') },
    { href: '/facilities', label: t('nav.facilities') },
  ]
}

export default function Navbar({ locale }: NavbarProps) {
  const { data: session, status } = useSession()
  const t = useTranslations()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const isRTL = locale === 'ar'
  const role = session?.user?.role as Role | undefined
  const [loggingOut, setLoggingOut] = useState(false)
  const isLoggedIn = status === 'authenticated' && !!session
  const navLinks = getRoleNavLinks(role, locale, t)

  function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    setUserMenuOpen(false)
    void performLogout('/').catch(() => setLoggingOut(false))
  }

  async function switchLocale() {
    const next = locale === 'ar' ? 'en' : 'ar'
    document.cookie = `locale=${next};path=/;max-age=31536000`
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow-primary group-hover:shadow-glow transition-shadow">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-white text-base leading-tight block tracking-wide">MRI</span>
              <span className="text-[10px] text-slate-400 leading-none">
                {locale === 'ar' ? 'منصة طبية موثوقة' : 'Trusted Medical Platform'}
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href}
                className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-primary/10 transition-all">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="hidden md:block"><SearchBar /></div>
            {isLoggedIn && <div className="hidden sm:block"><NotificationBell /></div>}

            <button onClick={switchLocale}
              className="flex items-center px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-primary/10 border border-white/10 text-xs text-slate-400 hover:text-white transition-all">
              {locale === 'ar' ? '🇺🇸 EN' : '🇸🇦 عر'}
            </button>

            {isLoggedIn ? (
              <div className="relative">
                <button onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-primary/10 border border-white/10 transition-all">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-white">
                    {session.user.email?.[0]?.toUpperCase() ?? session.user.piUsername?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <svg className={cn('w-3 h-3 text-slate-500 transition-transform hidden lg:block', userMenuOpen && 'rotate-180')}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <div className={cn(
                    'absolute top-full mt-2 w-52 bg-surface-elevated border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50',
                    isRTL ? 'left-0' : 'right-0',
                  )}>
                    <div className="px-3 py-2.5 border-b border-white/5">
                      <p className="text-xs text-slate-500">{t('nav.dashboard')}</p>
                      <p className="text-xs font-medium text-accent mt-0.5 capitalize">{session.user.role.toLowerCase()}</p>
                    </div>
                    <Link href={getDashboardLink(role)} onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300 hover:bg-primary/10 hover:text-white transition-all">
                      🏠 {t('nav.dashboard')}
                    </Link>
                    <Link href="/profile" onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300 hover:bg-primary/10 hover:text-white transition-all">
                      👤 {locale === 'ar' ? 'الملف الشخصي' : 'Profile'}
                    </Link>
                    <button type="button" onClick={() => void handleLogout()} disabled={loggingOut}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-danger/10 transition-all disabled:opacity-50">
                      🚪 {loggingOut ? (locale === 'ar' ? 'جاري الخروج...' : 'Signing out...') : t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link href="/login" className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">
                  {t('nav.login')}
                </Link>
                <Link href="/register"
                  className="px-3 py-1.5 text-sm bg-primary hover:bg-primary-400 text-white rounded-lg font-medium transition-all shadow-glow-primary">
                  {t('nav.register')}
                </Link>
              </div>
            )}

            <button onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-white/5 py-3 space-y-1 animate-fade-in">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-primary/10">
                {link.label}
              </Link>
            ))}
            {isLoggedIn && <div className="px-3 pt-2 border-t border-white/5"><NotificationBell /></div>}
            <div className="px-3 pt-2"><SearchBar variant="hero" /></div>
          </div>
        )}
      </div>
    </nav>
  )
}
