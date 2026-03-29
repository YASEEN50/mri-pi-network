// src/middleware.ts
// Route protection based on role + approval status
import { withAuth, NextRequestWithAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { Role, ApprovalStatus } from '@prisma/client'

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const role = token.role as Role
    const approvalStatus = token.approvalStatus as ApprovalStatus | null
    const isProfileComplete = token.isProfileComplete as boolean

    // -------------------------------------------------------------------------
    // إذا لم يكتمل الـ Profile → أرسله لصفحة الإعداد
    // (ما عدا صفحة select-role نفسها)
    // -------------------------------------------------------------------------
    if (!isProfileComplete && !pathname.startsWith('/select-role') && !pathname.startsWith('/onboarding')) {
      return NextResponse.redirect(new URL('/select-role', req.url))
    }

    // -------------------------------------------------------------------------
    // Admin only routes
    // -------------------------------------------------------------------------
    if (pathname.startsWith('/admin') && role !== Role.ADMIN) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    // -------------------------------------------------------------------------
    // Doctor routes
    // -------------------------------------------------------------------------
    if (pathname.startsWith('/doctor')) {
      if (role !== Role.DOCTOR) {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
      // الطبيب غير المعتمد → صفحة الانتظار
      if (approvalStatus !== ApprovalStatus.APPROVED && !pathname.startsWith('/doctor/pending')) {
        return NextResponse.redirect(new URL('/doctor/pending', req.url))
      }
    }

    // -------------------------------------------------------------------------
    // Facility routes
    // -------------------------------------------------------------------------
    if (pathname.startsWith('/facility')) {
      if (role !== Role.FACILITY) {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
      if (approvalStatus !== ApprovalStatus.APPROVED && !pathname.startsWith('/facility/pending')) {
        return NextResponse.redirect(new URL('/facility/pending', req.url))
      }
    }

    // -------------------------------------------------------------------------
    // Client routes
    // -------------------------------------------------------------------------
    if (pathname.startsWith('/client') && role !== Role.CLIENT) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    '/admin/:path*',
    '/doctor/:path*',
    '/facility/:path*',
    '/client/:path*',
    '/select-role',
    '/onboarding/:path*',
    '/dashboard/:path*',
  ],
}
