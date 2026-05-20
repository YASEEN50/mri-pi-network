// src/app/api/auth/change-email/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { sendChangeEmailVerification } from '@/lib/email'
import { randomBytes } from 'crypto'
import { z } from 'zod'

const Schema = z.object({ newEmail: z.string().email() })

// POST - طلب تغيير البريد
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بريد إلكتروني غير صحيح' })

    const { newEmail } = parsed.data

    // تحقق أن البريد الجديد غير مستخدم
    const existing = await prisma.user.findUnique({ where: { email: newEmail } })
    if (existing) return ok({ error: true, message: 'هذا البريد الإلكتروني مستخدم بالفعل' })

    // احذف أي token قديم
    await prisma.verificationToken.deleteMany({
      where: { identifier: `change-email:${auth.context.userId}` },
    })

    // أنشئ token جديد
    const token = randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000) // ساعة

    await prisma.verificationToken.create({
      data: {
        identifier: `change-email:${auth.context.userId}:${newEmail}`,
        token,
        expires,
      },
    })

    // أرسل الإيميل للبريد الجديد
    await sendChangeEmailVerification(newEmail, token)

    return ok({ message: `تم إرسال رمز التحقق إلى ${newEmail}` })
  } catch (err) {
    console.error('[POST /api/auth/change-email]', err)
    return serverError()
  }
}