// src/app/api/auth/reset-password/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { findUserByAuthEmail } from '@/lib/auth/find-user-by-email'
import { normalizeAuthEmail } from '@/lib/auth/normalize-email'
import { hash } from 'bcryptjs'
import { z } from 'zod'

const Schema = z.object({
  email: z.string().trim().email().transform(normalizeAuthEmail),
  otp: z.string().length(6),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { email, otp, password } = parsed.data

    // التحقق من الرمز
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

    const user = await findUserByAuthEmail(email, { id: true })
    if (!user) return ok({ error: true, message: 'البريد غير مسجل' })

    // تحديث كلمة المرور وحذف الرمز
    const passwordHash = await hash(password, 12)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data:  { passwordHash },
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
