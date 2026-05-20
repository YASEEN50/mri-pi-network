'use client'
// src/components/common/Navbar.tsx

import { useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Role } from '@prisma/client'
import SearchBar from '@/components/common/SearchBar'

interface NavbarProps {
  locale: 'ar' | 'en'
}

export default function Navbar({ locale }: NavbarProps) {
  const { data: session } = useSession()
  const t = useTranslations()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const isRTL = locale === 'ar'

  async function switchLocale() {
    const next = locale === 'ar' ? 'en' : 'ar'
    document.cookie = `locale=${next};path=/;max-age=31536000`
    router.refresh()
  }

  function getDashboardLink() {
    if (!session) return '/dashboard'
    switch (session.user.role) {
      case Role.OWNER:    return '/owner'
      case Role.ADMIN:    return '/dashboard/admin/verification'
      case Role.DOCTOR:   return '/dashboard/doctor/schedule'
      case Role.FACILITY: return '/dashboard/facility/doctors'
      default:            return '/dashboard/client/appointments'
    }
  }

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="font-bold text-white text-sm hidden sm:block">
              {locale === 'ar' ? 'المنصة الطبية' : 'MedPlatform'}
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { href: '/',           label: t('nav.home') },
              { href: '/doctors',    label: t('nav.doctors') },
              { href: '/facilities', label: t('nav.facilities') },
              { href: '/publications', label: 'المنشورات' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="hidden md:block">
              <SearchBar />
            </div>
            {/* Language switcher */}
            <button
              onClick={switchLocale}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-all"
            >
              <span className="text-base">{locale === 'ar' ? '🇸🇦' : '🇺🇸'}</span>
              <span className="hidden sm:block font-medium">{locale === 'ar' ? 'EN' : 'عر'}</span>
            </button>

            {session ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xs font-bold text-white">
                    {session.user.email?.[0]?.toUpperCase() ?? session.user.piUsername?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <span className="text-xs text-slate-300 hidden sm:block max-w-[100px] truncate">
                    {session.user.email ?? `@${session.user.piUsername}`}
                  </span>
                  <svg className={`w-3 h-3 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <div className={`absolute top-full mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden ${isRTL ? 'left-0' : 'right-0'}`}>
                    <div className="px-3 py-2 border-b border-white/5">
                      <p className="text-xs text-slate-400">{t('nav.dashboard')}</p>
                      <p className="text-xs font-medium text-emerald-400 mt-0.5 capitalize">{session.user.role.toLowerCase()}</p>
                    </div>
                    <Link href={getDashboardLink()} onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-all">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      {t('nav.dashboard')}
                    </Link>
                    <button onClick={() => signOut({ callbackUrl: '/' })}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-all">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login"
                  className="px-3 py-1.5 text-sm text-slate-300 hover:text-white transition-colors">
                  {t('nav.login')}
                </Link>
                <Link href="/register"
                  className="px-3 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg font-medium transition-all shadow-lg shadow-emerald-500/20">
                  {t('nav.register')}
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
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

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/5 py-3 space-y-1">
            {[
              { href: '/',           label: t('nav.home') },
              { href: '/doctors',    label: t('nav.doctors') },
              { href: '/facilities', label: t('nav.facilities') },
              { href: '/publications', label: 'المنشورات' },
            ].map((link) => (
              <Link key={link.href} href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5">
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
