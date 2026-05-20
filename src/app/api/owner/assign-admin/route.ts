// src/app/api/owner/assign-admin/route.ts
import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const AssignSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = AssignSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { userId, reason } = parsed.data
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, role: true, piUsername: true },
    })
    if (!user) return ok({ error: true, message: 'المستخدم غير موجود' })
    if (user.role === Role.OWNER) return ok({ error: true, message: 'لا يمكن تعديل صلاحيات المالك' })
    if (user.role === Role.ADMIN) return ok({ error: true, message: 'المستخدم أدمن بالفعل' })

    await prisma.user.update({ where: { id: userId }, data: { role: Role.ADMIN } })

    await prisma.activityLog.create({
      data: {
        actorId: auth.context.userId,
        action: 'CREATE_ADMIN',
        targetType: 'USER',
        targetId: userId,
        details: { previousRole: user.role, reason },
      },
    })

    await prisma.notification.create({
      data: {
        userId,
        title: '🛡️ تم تعيينك مديراً',
        body: 'تم تعيينك مديراً في المنصة الطبية.',
        type: 'ADMIN_ASSIGNED',
        data: { reason },
      },
    })

    const displayName = user.email ?? user.piUsername ?? userId.slice(0, 8)
    return ok({ message: `تم تعيين ${displayName} مديراً بنجاح` })
  } catch (err) {
    console.error('[POST /api/owner/assign-admin]', err)
    return serverError()
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = AssignSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { userId, reason } = parsed.data
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, role: true, piUsername: true },
    })
    if (!user) return ok({ error: true, message: 'المستخدم غير موجود' })
    if (user.role === Role.OWNER) return ok({ error: true, message: 'لا يمكن تعديل صلاحيات المالك' })
    if (user.role !== Role.ADMIN) return ok({ error: true, message: 'المستخدم ليس أدمن' })

    await prisma.user.update({ where: { id: userId }, data: { role: Role.CLIENT } })

    await prisma.activityLog.create({
      data: {
        actorId: auth.context.userId,
        action: 'REMOVE_ADMIN',
        targetType: 'USER',
        targetId: userId,
        details: { reason },
      },
    })

    const displayName = user.email ?? user.piUsername ?? userId.slice(0, 8)
    return ok({ message: `تم إزالة صلاحيات ${displayName} بنجاح` })
  } catch (err) {
    console.error('[DELETE /api/owner/assign-admin]', err)
    return serverError()
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const type       = req.nextUrl.searchParams.get('type')
    const email      = req.nextUrl.searchParams.get('email')
    const piUsername = req.nextUrl.searchParams.get('piUsername')
    const userId     = req.nextUrl.searchParams.get('userId')

    // جلب كل الأدمنز
    if (type === 'admins') {
      const admins = await prisma.user.findMany({
        where: { role: Role.ADMIN, deletedAt: null },
        select: { id: true, email: true, piUsername: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
      return ok(admins)
    }

    // البحث بالـ userId مباشرة
    if (userId) {
      const user = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { id: true, email: true, role: true, piUsername: true },
      })
      return ok(user ? [user] : [])
    }

    // البحث بالـ piUsername
    if (piUsername) {
      const users = await prisma.user.findMany({
        where: {
          piUsername: { contains: piUsername, mode: 'insensitive' },
          deletedAt: null,
          role: { notIn: [Role.OWNER] },
        },
        select: { id: true, email: true, role: true, piUsername: true },
        take: 5,
      })
      return ok(users)
    }

    // البحث بالبريد الإلكتروني
    if (email) {
      const users = await prisma.user.findMany({
        where: {
          email: { contains: email, mode: 'insensitive' },
          deletedAt: null,
          role: { notIn: [Role.OWNER] },
        },
        select: { id: true, email: true, role: true, piUsername: true },
        take: 5,
      })
      return ok(users)
    }

    return ok([])
  } catch (err) {
    console.error('[GET /api/owner/assign-admin]', err)
    return serverError()
  }
}