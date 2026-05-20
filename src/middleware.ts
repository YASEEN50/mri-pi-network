// src/middleware.ts
import { withAuth, NextRequestWithAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { Role, ApprovalStatus } from '@prisma/client'

// المسارات المسموحة لمن لم يكمل الملف الشخصي بعد
const ONBOARDING_PATHS = ['/select-role', '/onboarding']
// المسارات المعفاة من فحص اكتمال الملف الشخصي
const PROFILE_EXEMPT_PATHS = ['/select-role', '/onboarding', '/owner', '/admin']

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token
    if (!token) return NextResponse.redirect(new URL('/login', req.url))

    const role = token.role as Role
    const approvalStatus = token.approvalStatus as ApprovalStatus | null
    const isProfileComplete = token.isProfileComplete as boolean

    // ── OWNER ──────────────────────────────────────────────
    if (pathname.startsWith('/owner') && role !== Role.OWNER) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    // ── ADMIN + OWNER ──────────────────────────────────────
    if (pathname.startsWith('/admin') && role !== Role.ADMIN && role !== Role.OWNER) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    // ── OWNER يذهب لـ /owner مباشرة إذا حاول الوصول لـ /dashboard ──
    if (pathname.startsWith('/dashboard') && role === Role.OWNER) {
      return NextResponse.redirect(new URL('/owner', req.url))
    }

    // ── الملف الشخصي غير مكتمل ──────────────────────────────
    const isExempt = PROFILE_EXEMPT_PATHS.some(p => pathname.startsWith(p))
    if (!isProfileComplete && !isExempt) {
      return NextResponse.redirect(new URL('/select-role', req.url))
    }

    // ── منع الدخول لـ onboarding بعد إكمال الملف ───────────
    const isOnboarding = ONBOARDING_PATHS.some(p => pathname.startsWith(p))
    if (isProfileComplete && isOnboarding) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // ── DOCTOR ─────────────────────────────────────────────
    if (pathname.startsWith('/doctor') || pathname.startsWith('/dashboard/doctor')) {
      if (role !== Role.DOCTOR) return NextResponse.redirect(new URL('/unauthorized', req.url))
      if (approvalStatus !== ApprovalStatus.APPROVED && !pathname.startsWith('/doctor/pending')) {
        return NextResponse.redirect(new URL('/doctor/pending', req.url))
      }
    }

    // ── FACILITY ───────────────────────────────────────────
    if (pathname.startsWith('/facility') || pathname.startsWith('/dashboard/facility')) {
      if (role !== Role.FACILITY) return NextResponse.redirect(new URL('/unauthorized', req.url))
      if (approvalStatus !== ApprovalStatus.APPROVED && !pathname.startsWith('/facility/pending')) {
        return NextResponse.redirect(new URL('/facility/pending', req.url))
      }
    }

    // ── ADMIN dashboard ────────────────────────────────────
    if (pathname.startsWith('/dashboard/admin')) {
      if (role !== Role.ADMIN && role !== Role.OWNER) {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
    }

    // ── CLIENT dashboard ───────────────────────────────────
    if (pathname.startsWith('/dashboard/client') && role !== Role.CLIENT) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    return NextResponse.next()
  },
  { callbacks: { authorized: ({ token }) => !!token } }
)

export const config = {
  matcher: [
    '/owner/:path*',
    '/admin/:path*',
    '/doctor/:path*',
    '/facility/:path*',
    '/select-role',
    '/select-role/:path*',
    '/onboarding/:path*',
    '/dashboard/:path*',
  ],}