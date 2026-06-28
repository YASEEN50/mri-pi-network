/**
 * Canonical Pi + Next.js route map.
 * Auth entry stays on static HTML (Pi Portal App URL = domain root).
 * Post-login app uses Next.js pages.
 */

/** Default destination after successful sign-in (authenticated home feed). */
export const POST_LOGIN_HOME = '/'

export const PI_STATIC_AUTH_PATHS = [
  '/',
  '/login',
  '/register',
  '/pi.html',
  '/pi-login.html',
  '/pi-email.html',
  '/pi-register.html',
] as const

/** Legacy static shell pages → Next.js (see docs/PI_ROUTES.md) */
export const PI_LEGACY_SHELL_REDIRECTS: Record<string, string> = {
  '/pi-app.html': '/dashboard',
  '/pi-dashboard.html': '/dashboard',
  '/pi-doctors.html': '/doctors',
  '/pi-appointments.html': '/dashboard',
  '/pi-profile.html': '/profile',
  '/pi-select-role.html': '/select-role',
  '/pi-owner.html': '/dashboard',
}

export function getDashboardPath(role: string): string {
  switch (role) {
    case 'OWNER':
      return '/owner'
    case 'ADMIN':
      return '/dashboard/admin/verification'
    case 'DOCTOR':
      return '/dashboard/doctor/schedule'
    case 'FACILITY':
      return '/dashboard/facility/overview'
    default:
      return '/dashboard/client/appointments'
  }
}

export function getAdminPath(role: string): string {
  if (role === 'OWNER') return '/owner'
  if (role === 'ADMIN') return '/dashboard/admin/verification'
  return '/dashboard'
}

export function doctorDetailPath(doctorId: string): string {
  return `/doctors/${doctorId}`
}

export interface PiRouteMap {
  dashboard: string
  doctors: string
  profile: string
  selectRole: string
  chat: {
    client: string
    doctor: string
  }
  legacyRedirects: Record<string, string>
  staticAuth: readonly string[]
}

export function getPiRouteMap(role = 'CLIENT'): PiRouteMap {
  return {
    dashboard: getDashboardPath(role),
    doctors: '/doctors',
    profile: '/profile',
    selectRole: '/select-role',
    chat: {
      client: '/dashboard/client/chat',
      doctor: '/dashboard/doctor/chat',
    },
    legacyRedirects: PI_LEGACY_SHELL_REDIRECTS,
    staticAuth: PI_STATIC_AUTH_PATHS,
  }
}

/** For ?site=full — use Next.js auth pages instead of static Pi HTML rewrites */
export function prefersFullNextSite(searchParams: URLSearchParams): boolean {
  return searchParams.get('site') === 'full'
}
