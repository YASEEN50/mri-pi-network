// src/app/api/notifications/[id]/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params

    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true },
    })

    // التحقق من الملكية
    if (!notification || notification.userId !== auth.context.userId) {
      return ok({ error: true, message: 'الإشعار غير موجود' })
    }

    await prisma.notification.update({
      where: { id },
      data:  { isRead: true, readAt: new Date() },
    })

    return ok({ message: 'تم تحديث الإشعار' })
  } catch (err) {
    console.error('[PATCH /api/notifications/[id]]', err)
    return serverError()
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params

    const notification = await prisma.notification.findUnique({
      where: { id }, select: { userId: true },
    })

    if (!notification || notification.userId !== auth.context.userId) {
      return ok({ error: true, message: 'الإشعار غير موجود' })
    }

    await prisma.notification.delete({ where: { id } })
    return ok({ message: 'تم حذف الإشعار' })
  } catch (err) {
    console.error('[DELETE /api/notifications/[id]]', err)
    return serverError()
  }
}
