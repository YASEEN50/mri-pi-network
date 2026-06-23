// src/middleware.ts
import { withAuth, NextRequestWithAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { Role, ApprovalStatus } from '@prisma/client'

const ONBOARDING_PATHS = ['/select-role', '/onboarding']
const PROFILE_EXEMPT_PATHS = ['/select-role', '/onboarding', '/owner', '/admin']

const PI_FRAME_CSP =
  "frame-ancestors 'self' https://minepi.com https://*.minepi.com https://sandbox.minepi.com https://*.pi.network"

function applyPiWebViewHeaders(res: NextResponse): NextResponse {
  res.headers.delete('X-Frame-Options')
  res.headers.set('Content-Security-Policy', PI_FRAME_CSP)
  return res
}

/** Pi Portal requires root domain — serve lightweight Pi app pages (unless ?site=full). */
function piStaticRewrite(req: NextRequest): NextResponse | null {
  const { pathname, searchParams } = req.nextUrl
  if (searchParams.get('site') === 'full') return null

  const exact: Record<string, string> = {
    '/': '/pi.html',
    '/login': '/pi-login.html',
    '/register': '/pi-register.html',
    '/profile': '/pi-profile.html',
    '/dashboard': '/pi-dashboard.html',
    '/doctors': '/pi-doctors.html',
    '/owner': '/pi-owner.html',
    '/select-role': '/pi-select-role.html',
  }

  if (exact[pathname]) {
    return applyPiWebViewHeaders(NextResponse.rewrite(new URL(exact[pathname], req.url)))
  }

  if (pathname.startsWith('/dashboard/')) {
    return applyPiWebViewHeaders(NextResponse.rewrite(new URL('/pi-dashboard.html', req.url)))
  }

  const doctorMatch = pathname.match(/^\/doctors\/([^/]+)$/)
  if (doctorMatch) {
    const url = new URL('/pi-doctor.html', req.url)
    url.searchParams.set('id', doctorMatch[1])
    return applyPiWebViewHeaders(NextResponse.rewrite(url))
  }

  if (pathname.startsWith('/owner/')) {
    return applyPiWebViewHeaders(NextResponse.rewrite(new URL('/pi-owner.html', req.url)))
  }

  return null
}

function isProtectedPath(pathname: string): boolean {
  const prefixes = ['/owner', '/admin', '/doctor', '/facility', '/select-role', '/onboarding', '/dashboard']
  return prefixes.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

const authMiddleware = withAuth(
  function middleware(req: NextRequestWithAuth) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token
    if (!token) return NextResponse.redirect(new URL('/login', req.url))

    const role = token.role as Role
    const approvalStatus = token.approvalStatus as ApprovalStatus | null
    const isProfileComplete = token.isProfileComplete as boolean

    if (pathname.startsWith('/owner') && role !== Role.OWNER) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    if (pathname.startsWith('/admin') && role !== Role.ADMIN && role !== Role.OWNER) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    if (pathname.startsWith('/dashboard') && role === Role.OWNER) {
      if (!pathname.startsWith('/dashboard/admin')) {
        return NextResponse.redirect(new URL('/owner', req.url))
      }
    }

    const isExempt = PROFILE_EXEMPT_PATHS.some(p => pathname.startsWith(p))
    if (!isProfileComplete && !isExempt) {
      return NextResponse.redirect(new URL('/select-role', req.url))
    }

    const isOnboarding = ONBOARDING_PATHS.some(p => pathname.startsWith(p))
    if (isProfileComplete && isOnboarding) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    if (pathname.startsWith('/doctor') || pathname.startsWith('/dashboard/doctor')) {
      if (role !== Role.DOCTOR) return NextResponse.redirect(new URL('/unauthorized', req.url))
      const doctorPendingOk =
        pathname.startsWith('/doctor/pending') || pathname.startsWith('/doctor/verify')
      if (approvalStatus !== ApprovalStatus.APPROVED && !doctorPendingOk) {
        return NextResponse.redirect(new URL('/doctor/pending', req.url))
      }
    }

    if (pathname.startsWith('/facility') || pathname.startsWith('/dashboard/facility')) {
      if (role !== Role.FACILITY) return NextResponse.redirect(new URL('/unauthorized', req.url))
      const facilityPendingOk = pathname.startsWith('/facility/pending') || pathname.startsWith('/facility/verify')
      if (approvalStatus !== ApprovalStatus.APPROVED && !facilityPendingOk) {
        return NextResponse.redirect(new URL('/facility/pending', req.url))
      }
    }

    if (pathname.startsWith('/dashboard/admin')) {
      if (role !== Role.ADMIN && role !== Role.OWNER) {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
    }

    if (pathname.startsWith('/dashboard/client') && role !== Role.CLIENT) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    return NextResponse.next()
  },
  { callbacks: { authorized: ({ token }) => !!token } },
)

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const piRewrite = piStaticRewrite(req)
  if (piRewrite) return piRewrite

  if (isProtectedPath(req.nextUrl.pathname)) {
    return authMiddleware(req as NextRequestWithAuth, event)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/register',
    '/profile',
    '/doctors',
    '/doctors/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/owner',
    '/owner/:path*',
    '/select-role',
    '/select-role/:path*',
    '/admin/:path*',
    '/doctor/:path*',
    '/facility/:path*',
    '/onboarding/:path*',
  ],
}
