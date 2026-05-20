// src/app/api/auth/change-password/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { sendPasswordChangedNotification } from '@/lib/email'
import { compare, hash } from 'bcryptjs'
import { z } from 'zod'

const Schema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return ok({ error: true, message: parsed.error.errors[0]?.message || 'بيانات غير صحيحة' })
    }

    const { currentPassword, newPassword } = parsed.data

    const user = await prisma.user.findUnique({
      where: { id: auth.context.userId },
      select: { passwordHash: true, email: true },
    })

    if (!user?.passwordHash) {
      return ok({ error: true, message: 'حسابك مرتبط بـ Pi Network ولا يملك كلمة مرور' })
    }

    // تحقق من كلمة المرور الحالية
    const isValid = await compare(currentPassword, user.passwordHash)
    if (!isValid) {
      return ok({ error: true, message: 'كلمة المرور الحالية غير صحيحة' })
    }

    // تحديث كلمة المرور
    const hashedPassword = await hash(newPassword, 12)
    await prisma.user.update({
      where: { id: auth.context.userId },
      data: { passwordHash: hashedPassword },
    })

    // إرسال إشعار
    if (user.email) {
      await sendPasswordChangedNotification(user.email)
    }

    return ok({ message: 'تم تغيير كلمة المرور بنجاح' })
  } catch (err) {
    console.error('[POST /api/auth/change-password]', err)
    return serverError()
  }
}