import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 20)

    const notifications = await prisma.notification.findMany({
      where: { userId: auth.context.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return ok(notifications, { total: notifications.length })
  } catch (err) {
    console.error('[GET /api/notifications]', err)
    return serverError()
  }
}

export async function PATCH(_req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    await prisma.notification.updateMany({
      where: { userId: auth.context.userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })

    return ok({ message: 'تم تحديث الإشعارات' })
  } catch (err) {
    console.error('[PATCH /api/notifications]', err)
    return serverError()
  }
}
