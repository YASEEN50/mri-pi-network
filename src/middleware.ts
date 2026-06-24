// src/middleware.ts — Edge-safe (no @prisma/client imports)
import { withAuth, NextRequestWithAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'

const Role = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  DOCTOR: 'DOCTOR',
  FACILITY: 'FACILITY',
  CLIENT: 'CLIENT',
} as const

const ApprovalStatus = {
  APPROVED: 'APPROVED',
} as const

const ONBOARDING_PATHS = ['/select-role', '/onboarding']
const PROFILE_EXEMPT_PATHS = ['/select-role', '/onboarding', '/owner', '/admin']

const PI_FRAME_CSP =
  "frame-ancestors 'self' https://minepi.com https://*.minepi.com https://sandbox.minepi.com https://*.pi.network https://pinet.com https://*.pinet.com"

function applyPiWebViewHeaders(res: NextResponse): NextResponse {
  res.headers.delete('X-Frame-Options')
  res.headers.set('Content-Security-Policy', PI_FRAME_CSP)
  return res
}

/** Pi Portal requires root domain — static login pages only (unless ?site=full). */
function piStaticRewrite(req: NextRequest): NextResponse | null {
  const { pathname, searchParams } = req.nextUrl
  if (searchParams.get('site') === 'full' || searchParams.get('mfa') === 'required') return null

  if (pathname === '/') {
    return applyPiWebViewHeaders(NextResponse.rewrite(new URL('/pi.html', req.url)))
  }
  if (pathname === '/login') {
    return applyPiWebViewHeaders(NextResponse.rewrite(new URL('/pi-login.html', req.url)))
  }
  if (pathname === '/register') {
    return applyPiWebViewHeaders(NextResponse.rewrite(new URL('/pi-register.html', req.url)))
  }
  return null
}

function isPiRequest(req: NextRequest): boolean {
  const ua = req.headers.get('user-agent') ?? ''
  const host = req.headers.get('host') ?? ''
  return /PiBrowser|pibrowser|pi browser|pinetwork|minepi/i.test(ua) || /\.pinet\.com$/i.test(host)
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

    const role = token.role as string
    const approvalStatus = token.approvalStatus as string | null | undefined
    const isProfileComplete = token.isProfileComplete as boolean
    const mfaEnabled = token.mfaEnabled === true
    const mfaVerified = token.mfaVerified === true
    const isPrivileged = role === Role.ADMIN || role === Role.OWNER

    const isMfaSetupPath = pathname.startsWith('/admin/security')

    if (isPrivileged && !isMfaSetupPath && (pathname.startsWith('/admin') || pathname.startsWith('/owner'))) {
      if (!mfaEnabled) {
        return NextResponse.redirect(new URL('/admin/security/mfa', req.url))
      }
      if (!mfaVerified) {
        return NextResponse.redirect(new URL('/login?site=full&mfa=required', req.url))
      }
    }

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
  try {
    const piRewrite = piStaticRewrite(req)
    if (piRewrite) return piRewrite

    let res: NextResponse
    if (isProtectedPath(req.nextUrl.pathname)) {
      res = authMiddleware(req as NextRequestWithAuth, event) as NextResponse
    } else {
      res = NextResponse.next()
    }

    if (isPiRequest(req)) applyPiWebViewHeaders(res)
    return res
  } catch (err) {
    console.error('[middleware]', err)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/register',
    '/owner/:path*',
    '/admin/:path*',
    '/doctor/:path*',
    '/facility/:path*',
    '/select-role',
    '/select-role/:path*',
    '/onboarding/:path*',
    '/dashboard',
    '/dashboard/:path*',
  ],
}
