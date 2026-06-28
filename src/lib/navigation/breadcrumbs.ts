import { Role } from '@prisma/client'

export interface NavCrumb {
  label: string
  href?: string
}

const HIDDEN_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/select-role',
])

const SEGMENT_LABELS: Record<string, { ar: string; en: string }> = {
  dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
  admin: { ar: 'الإدارة', en: 'Admin' },
  owner: { ar: 'لوحة المالك', en: 'Owner' },
  pending: { ar: 'الطلبات المعلقة', en: 'Pending requests' },
  verification: { ar: 'التحقق', en: 'Verification' },
  'verification-v2': { ar: 'التحقق المتقدم (v2)', en: 'Verification v2' },
  doctors: { ar: 'الأطباء', en: 'Doctors' },
  facilities: { ar: 'المنشآت', en: 'Facilities' },
  verify: { ar: 'مراجعة الطلب', en: 'Review request' },
  publications: { ar: 'المنشورات', en: 'Publications' },
  profile: { ar: 'الملف الشخصي', en: 'Profile' },
  appointments: { ar: 'المواعيد', en: 'Appointments' },
  'consult-now': { ar: 'استشارة فورية', en: 'Instant consult' },
  onboarding: { ar: 'إعداد الحساب', en: 'Onboarding' },
  doctor: { ar: 'الطبيب', en: 'Doctor' },
  client: { ar: 'العميل', en: 'Client' },
  facility: { ar: 'المنشأة', en: 'Facility' },
  schedule: { ar: 'الجدول', en: 'Schedule' },
  chat: { ar: 'المحادثات', en: 'Chat' },
  settings: { ar: 'الإعدادات', en: 'Settings' },
  analytics: { ar: 'التحليلات', en: 'Analytics' },
  availability: { ar: 'التوفر', en: 'Availability' },
  referrals: { ar: 'الإحالات', en: 'Referrals' },
  premio: { ar: 'بريميو', en: 'Premio' },
  'instant-consult': { ar: 'استشارة فورية', en: 'Instant consult' },
  'payment-settings': { ar: 'إعدادات الدفع', en: 'Payment settings' },
  'medical-records': { ar: 'السجل الطبي', en: 'Medical records' },
  overview: { ar: 'نظرة عامة', en: 'Overview' },
  departments: { ar: 'الأقسام', en: 'Departments' },
  'department-doctors': { ar: 'أطباء الأقسام', en: 'Department doctors' },
  'on-call': { ar: 'المناوبات', en: 'On-call' },
  moderation: { ar: 'الإشراف', en: 'Moderation' },
  'risk-config': { ar: 'إعداد المخاطر', en: 'Risk config' },
  'assign-admin': { ar: 'تعيين مشرف', en: 'Assign admin' },
  'give-premio': { ar: 'منح بريميو', en: 'Give premio' },
  'premio-settings': { ar: 'إعدادات بريميو', en: 'Premio settings' },
  stats: { ar: 'الإحصائيات', en: 'Statistics' },
  intelligence: { ar: 'الذكاء', en: 'Intelligence' },
  'fraud-events': { ar: 'احتيال', en: 'Fraud events' },
  security: { ar: 'الأمان', en: 'Security' },
  mfa: { ar: 'المصادقة الثنائية', en: 'MFA' },
  reviews: { ar: 'التقييمات', en: 'Reviews' },
  video: { ar: 'مكالمة فيديو', en: 'Video call' },
  rating: { ar: 'التقييم', en: 'Rating' },
  contact: { ar: 'تواصل', en: 'Contact' },
  about: { ar: 'من نحن', en: 'About' },
  privacy: { ar: 'الخصوصية', en: 'Privacy' },
  terms: { ar: 'الشروط', en: 'Terms' },
  signup: { ar: 'تسجيل', en: 'Signup' },
  'doctors-map': { ar: 'خريطة الأطباء', en: 'Doctors map' },
  advertise: { ar: 'إعلان مدفوع', en: 'Advertise' },
  unauthorized: { ar: 'غير مصرح', en: 'Unauthorized' },
}

function isDynamicSegment(segment: string): boolean {
  return /^[0-9a-f-]{8,}$/i.test(segment) || /^\d+$/.test(segment)
}

function segmentLabel(segment: string, locale: 'ar' | 'en'): string {
  if (isDynamicSegment(segment)) {
    return locale === 'ar' ? 'تفاصيل' : 'Details'
  }
  return SEGMENT_LABELS[segment]?.[locale] ?? segment.replace(/-/g, ' ')
}

export function getDashboardHref(role?: string): string {
  switch (role) {
    case Role.OWNER:
      return '/owner'
    case Role.ADMIN:
      return '/dashboard/admin/verification'
    case Role.DOCTOR:
      return '/dashboard/doctor/schedule'
    case Role.FACILITY:
      return '/dashboard/facility/overview'
    case Role.CLIENT:
      return '/dashboard/client/appointments'
    default:
      return '/'
  }
}

export function getDashboardLabel(locale: 'ar' | 'en', role?: string): string {
  if (role === Role.OWNER) return locale === 'ar' ? 'لوحة المالك' : 'Owner dashboard'
  if (role && role !== Role.CLIENT) {
    return locale === 'ar' ? 'لوحة التحكم' : 'Dashboard'
  }
  return locale === 'ar' ? 'الرئيسية' : 'Home'
}

/** Parent path for the prominent back button (may skip intermediate UUID segments). */
export function resolveBackHref(pathname: string): string | null {
  if (HIDDEN_PATHS.has(pathname)) return null

  const rules: Array<[RegExp, string | ((pathname: string) => string)]> = [
    [/^\/admin\/doctors\/[^/]+\/verify$/, '/dashboard/admin/pending'],
    [/^\/admin\/facilities\/[^/]+\/verify$/, '/dashboard/admin/pending'],
    [/^\/admin\/verification-v2\/[^/]+$/, '/admin/verification-v2'],
    [/^\/admin\/verification-v2$/, '/dashboard/admin/pending'],
    [/^\/admin\/publications$/, '/admin'],
    [/^\/admin\/verification\/[^/]+$/, '/admin/verification'],
    [/^\/owner\/admins\/[^/]+$/, '/owner'],
    [/^\/doctors\/([^/]+)\/reviews$/, (p) => `/doctors/${p.split('/')[2]}`],
    [/^\/facilities\/[^/]+$/, '/facilities'],
    [/^\/doctors\/[^/]+$/, '/doctors'],
    [/^\/publications\/[^/]+$/, '/publications'],
    [/^\/appointments\/([^/]+)\/(video|rating)$/, (p) => `/appointments/${p.split('/')[2]}`],
    [/^\/appointments\/[^/]+$/, '/appointments'],
  ]

  for (const [pattern, target] of rules) {
    if (pattern.test(pathname)) {
      return typeof target === 'function' ? target(pathname) : target
    }
  }

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length <= 1) {
    return segments.length === 1 ? '/' : null
  }

  segments.pop()
  return `/${segments.join('/')}`
}

function prependRootCrumb(
  pathname: string,
  crumbs: NavCrumb[],
  locale: 'ar' | 'en',
  role?: string,
): NavCrumb[] {
  const rootHref = pathname.startsWith('/owner')
    ? '/owner'
    : pathname.startsWith('/dashboard') || pathname.startsWith('/admin')
      ? getDashboardHref(role)
      : '/'

  const rootLabel = pathname.startsWith('/owner')
    ? getDashboardLabel(locale, Role.OWNER)
    : pathname.startsWith('/dashboard') || pathname.startsWith('/admin')
      ? getDashboardLabel(locale, role)
      : getDashboardLabel(locale)

  if (crumbs[0]?.href === rootHref) return crumbs
  return [{ label: rootLabel, href: rootHref }, ...crumbs]
}

export function buildNavigationTrail(
  pathname: string,
  locale: 'ar' | 'en',
  role?: string,
): { backHref: string | null; backLabel: string | null; crumbs: NavCrumb[] } | null {
  if (HIDDEN_PATHS.has(pathname)) return null

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  const crumbs: NavCrumb[] = []
  let path = ''

  for (let i = 0; i < segments.length; i++) {
    path += `/${segments[i]}`
    const isLast = i === segments.length - 1
    crumbs.push({
      label: segmentLabel(segments[i], locale),
      href: isLast ? undefined : path,
    })
  }

  const trail = prependRootCrumb(pathname, crumbs, locale, role)
  const backHref = resolveBackHref(pathname)

  let backLabel: string | null = null
  if (backHref) {
    const match = trail.find((c) => c.href === backHref)
    backLabel = match?.label ?? (locale === 'ar' ? 'رجوع' : 'Back')
  }

  return { backHref, backLabel, crumbs: trail }
}
