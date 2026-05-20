// src/app/api/auth/confirm-email-change/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.redirect(new URL('/profile?error=invalid-token', req.url))
    }

    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken) {
      return NextResponse.redirect(new URL('/profile?error=invalid-token', req.url))
    }

    if (new Date() > verificationToken.expires) {
      await prisma.verificationToken.delete({ where: { token } })
      return NextResponse.redirect(new URL('/profile?error=expired-token', req.url))
    }

    // استخرج userId والبريد الجديد من identifier
    // identifier = "change-email:userId:newEmail"
    const parts = verificationToken.identifier.split(':')
    const userId = parts[1]
    const newEmail = parts.slice(2).join(':') // في حالة البريد يحتوي على ':'

    // تحقق أن البريد غير مستخدم
    const existing = await prisma.user.findUnique({ where: { email: newEmail } })
    if (existing) {
      await prisma.verificationToken.delete({ where: { token } })
      return NextResponse.redirect(new URL('/profile?error=email-taken', req.url))
    }

    // حدّث البريد
    await prisma.user.update({
      where: { id: userId },
      data: { email: newEmail, emailVerified: new Date() },
    })

    // احذف الـ token
    await prisma.verificationToken.delete({ where: { token } })

    return NextResponse.redirect(new URL('/profile?success=email-changed', req.url))
  } catch (err) {
    console.error('[GET /api/auth/confirm-email-change]', err)
    return NextResponse.redirect(new URL('/profile?error=server-error', req.url))
  }
}