// src/app/api/auth/verify-email/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.redirect(new URL('/verify-email?error=invalid', req.url))
    }

    const record = await prisma.verificationToken.findUnique({
      where: { token },
    })

    if (!record || !record.identifier.startsWith('verify:')) {
      return NextResponse.redirect(new URL('/verify-email?error=invalid', req.url))
    }

    if (new Date() > record.expires) {
      await prisma.verificationToken.delete({ where: { token } })
      return NextResponse.redirect(new URL('/verify-email?error=expired', req.url))
    }

    const email = record.identifier.replace('verify:', '')

    await prisma.$transaction([
      prisma.user.update({
        where: { email },
        data:  { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({ where: { token } }),
    ])

    return NextResponse.redirect(new URL('/verify-email?success=true', req.url))
  } catch (err) {
    console.error('[GET /api/auth/verify-email]', err)
    return NextResponse.redirect(new URL('/verify-email?error=server', req.url))
  }
}
