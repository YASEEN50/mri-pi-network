// src/app/api/auth/reset-password/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { rateLimitAuth } from '@/lib/rate-limit'
import { findUserByAuthEmail } from '@/lib/auth/find-user-by-email'
import { normalizeAuthEmail } from '@/lib/auth/normalize-email'
import { requiresMfaRole } from '@/lib/mfa/session-flags'
import { verifyUserMfaCode } from '@/lib/mfa/verify-user-code'
import { hash } from 'bcryptjs'
import { z } from 'zod'

const Schema = z
  .object({
    email: z.string().trim().email().transform(normalizeAuthEmail),
    password: z.string().min(8),
    otp: z.string().length(6).optional(),
    mfaCode: z.string().min(6).max(16).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.otp && !data.mfaCode) {
      ctx.addIssue({ code: 'custom', message: 'رمز التحقق مطلوب', path: ['otp'] })
    }
    if (data.otp && data.mfaCode) {
      ctx.addIssue({ code: 'custom', message: 'استخدم رمزاً واحداً فقط', path: ['otp'] })
    }
  })

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = rateLimitAuth(ip, 'reset-password')
    if (!rl.success) {
      return ok({ error: true, message: `محاولات كثيرة. انتظر ${rl.resetIn} ثانية.` })
    }

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { email, password, otp, mfaCode } = parsed.data

    const user = await findUserByAuthEmail(email, {
      id: true,
      role: true,
      mfaEnabled: true,
    })
    if (!user) return ok({ error: true, message: 'البريد غير مسجل' })

    if (mfaCode) {
      if (!requiresMfaRole(user.role) || !user.mfaEnabled) {
        return ok({ error: true, message: 'إعادة التعيين عبر MFA غير متاحة لهذا الحساب' })
      }

      const { verified, remainingBackupCodes } = await verifyUserMfaCode(user.id, mfaCode)
      if (!verified) {
        return ok({ error: true, message: 'رمز MFA غير صحيح' })
      }

      const passwordHash = await hash(password, 12)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          ...(remainingBackupCodes ? { mfaBackupCodes: remainingBackupCodes } : {}),
        },
      })

      return ok({ success: true, message: 'تم تغيير كلمة المرور بنجاح' })
    }

    const record = await prisma.verificationToken.findFirst({
      where: { identifier: `reset:${email}`, token: otp },
    })

    if (!record) {
      return ok({ error: true, message: 'رمز التحقق غير صحيح' })
    }

    if (new Date() > record.expires) {
      await prisma.verificationToken.deleteMany({
        where: { identifier: `reset:${email}` },
      })
      return ok({ error: true, message: 'انتهت صلاحية الرمز. اطلب رمزاً جديداً.' })
    }

    const passwordHash = await hash(password, 12)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.verificationToken.deleteMany({
        where: { identifier: `reset:${email}` },
      }),
    ])

    return ok({ success: true, message: 'تم تغيير كلمة المرور بنجاح' })
  } catch (err) {
    console.error('[POST /api/auth/reset-password]', err)
    return serverError()
  }
}
