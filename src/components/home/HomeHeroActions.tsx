import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Role } from '@prisma/client'

interface HomeHeroActionsProps {
  locale: 'ar' | 'en'
  role?: Role
  isLoggedIn: boolean
}

function dashboardCta(role: Role | undefined, locale: 'ar' | 'en'): { href: string; label: string } | null {
  switch (role) {
    case Role.DOCTOR:
      return {
        href: '/dashboard/doctor/publications',
        label: locale === 'ar' ? 'منشوراتي' : 'My publications',
      }
    case Role.FACILITY:
      return {
        href: '/dashboard/facility/overview',
        label: locale === 'ar' ? 'لوحة المنشأة' : 'Facility dashboard',
      }
    case Role.ADMIN:
      return {
        href: '/dashboard/admin/verification',
        label: locale === 'ar' ? 'لوحة التحكم' : 'Admin dashboard',
      }
    case Role.OWNER:
      return {
        href: '/owner',
        label: locale === 'ar' ? 'لوحة المالك' : 'Owner dashboard',
      }
    case Role.CLIENT:
      return {
        href: '/dashboard/client/appointments',
        label: locale === 'ar' ? 'مواعيدي' : 'My appointments',
      }
    default:
      return null
  }
}

export default async function HomeHeroActions({ locale, role, isLoggedIn }: HomeHeroActionsProps) {
  const t = await getTranslations('home')
  const dashboard = isLoggedIn ? dashboardCta(role, locale) : null

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
      <Link
        href={role === Role.DOCTOR ? '/dashboard/doctor/schedule' : '/doctors'}
        className="px-8 py-3.5 bg-gradient-to-r from-primary to-primary-600 hover:from-primary-400 hover:to-primary text-white font-semibold rounded-xl transition-all shadow-glow-primary text-sm"
      >
        {role === Role.DOCTOR
          ? (locale === 'ar' ? 'جدولي' : 'My schedule')
          : t('hero_cta')}
      </Link>
      <Link
        href="/publications"
        className="px-8 py-3.5 bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/30 text-white font-semibold rounded-xl transition-all text-sm"
      >
        {locale === 'ar' ? 'منشورات الأطباء' : 'Doctor publications'}
      </Link>
      {dashboard ? (
        <Link
          href={dashboard.href}
          className="px-8 py-3.5 bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/30 text-white font-semibold rounded-xl transition-all text-sm"
        >
          {dashboard.label}
        </Link>
      ) : (
        <Link
          href="/register"
          className="px-8 py-3.5 bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/30 text-white font-semibold rounded-xl transition-all text-sm"
        >
          {t('hero_cta_secondary')}
        </Link>
      )}
    </div>
  )
}
