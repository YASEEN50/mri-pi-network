import { NextRequest } from 'next/server'
import { hash } from 'bcryptjs'
import { randomBytes } from 'crypto'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { linkEmailToUser } from '@/lib/auth/account-linking'
import { prisma } from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/email'
import { shouldAutoVerifyEmail } from '@/lib/auth/email-verify-helper'
import { z } from 'zod'

const Schema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح').toLowerCase(),
  password: z
    .string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .regex(/[A-Z]/, 'يجب أن تحتوي على حرف كبير')
    .regex(/[0-9]/, 'يجب أن تحتوي على رقم'),
})

const ERROR_MESSAGES: Record<string, string> = {
  EMAIL_ALREADY_SET: 'حسابك يحتوي على بريد إلكتروني بالفعل',
  EMAIL_TAKEN: 'هذا البريد الإلكتروني مستخدم بالفعل',
  USER_NOT_FOUND: 'المستخدم غير موجود',
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return ok({ error: true, message: parsed.error.errors[0]?.message ?? 'بيانات غير صحيحة' })
    }

    const { email, password } = parsed.data
    const passwordHash = await hash(password, 12)
    const user = await linkEmailToUser(auth.context.userId, email, passwordHash)

    if (shouldAutoVerifyEmail()) {
      await prisma.user.update({
        where: { id: user.id },
        data:  { emailVerified: new Date() },
      })
    } else {
      try {
        const token = randomBytes(32).toString('hex')
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
        await prisma.verificationToken.deleteMany({ where: { identifier: `verify:${email}` } })
        await prisma.verificationToken.create({
          data: { identifier: `verify:${email}`, token, expires },
        })
        await sendVerificationEmail(email, token)
      } catch (emailErr) {
        console.error('[link-email] verification email failed:', emailErr)
      }
    }

    return ok({
      message: shouldAutoVerifyEmail()
        ? 'تم ربط البريد الإلكتروني — يمكنك الدخول بالبريد الآن.'
        : 'تم ربط البريد الإلكتروني. تحقق من صندوق الوارد لتأكيد البريد.',
      email: user.email,
      autoVerified: shouldAutoVerifyEmail(),
    })
  } catch (err) {
    if (err instanceof Error && ERROR_MESSAGES[err.message]) {
      return ok({ error: true, message: ERROR_MESSAGES[err.message] })
    }
    console.error('[POST /api/auth/link-email]', err)
    return serverError()
  }
}
