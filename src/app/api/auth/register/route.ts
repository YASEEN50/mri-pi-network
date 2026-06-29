// src/app/api/auth/register/route.ts
import { NextRequest } from 'next/server'
import { hash } from 'bcryptjs'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { created, fromAppError, parseBody, serverError } from '@/lib/api-response'
import { RegisterSchema } from '@/lib/validations/auth.schema'
import { ConflictError } from '@/core/errors'
import { sendVerificationEmail } from '@/lib/email'
import { shouldAutoVerifyEmail } from '@/lib/auth/email-verify-helper'
import { rateLimitAuth } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    const rl  = rateLimitAuth(ip, 'register')
    if (!rl.success) {
      return fromAppError({ code: 'RATE_LIMIT', message: `محاولات كثيرة. انتظر ${rl.resetIn} ثانية.`, statusCode: 429 } as any)
    }

    const body   = await req.json()
    const parsed = parseBody(RegisterSchema, body)
    if (!parsed.success) return parsed.response

    const { email, password, role } = parsed.data

    const exists = await prisma.user.findFirst({
      where: { email, deletedAt: null }, select: { id: true },
    })
    if (exists) return fromAppError(new ConflictError('هذا البريد الإلكتروني مسجل مسبقاً'))

    const passwordHash = await hash(password, 12)
    const autoVerify = shouldAutoVerifyEmail()
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        ...(autoVerify ? { emailVerified: new Date() } : {}),
      },
      select: { id: true, email: true, role: true, createdAt: true },
    })

    if (!autoVerify) {
      try {
        const token   = randomBytes(32).toString('hex')
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
        await prisma.verificationToken.create({
          data: { identifier: `verify:${email}`, token, expires },
        })
        await sendVerificationEmail(email, token)
      } catch (emailErr) {
        console.error('[register] فشل إرسال إيميل التحقق:', emailErr)
      }
    }

    return created({ user, autoVerified: autoVerify })
  } catch (err) {
    console.error('[POST /api/auth/register]', err)
    return serverError()
  }
}
