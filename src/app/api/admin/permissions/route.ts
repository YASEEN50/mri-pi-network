// src/app/api/admin/permissions/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ALL_ADMIN_PERMISSIONS } from '@/lib/admin/permissions'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role, ActivityType } from '@prisma/client'
import { UnauthorizedError } from '@/core/errors'
import { z } from 'zod'

const PermSchema = z.object({
  adminId:     z.string().uuid(),
  permissions: z.array(z.string()),
})

// GET — جلب صلاحيات أدمن معين
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER, Role.ADMIN] })
    if (!auth.success) return fromAppError(auth.error)

    const adminId = req.nextUrl.searchParams.get('adminId') ?? auth.context.userId

    if (
      auth.context.role === Role.ADMIN &&
      adminId !== auth.context.userId
    ) {
      return fromAppError(new UnauthorizedError('لا يمكنك عرض صلاحيات مدير آخر'))
    }

    const perms = await db.adminPermission.findMany({
      where: { adminId, granted: true },
      select: { permission: true },
    })

    return ok({
      adminId,
      permissions: perms.map((p: any) => p.permission),
      allPermissions: ALL_ADMIN_PERMISSIONS,
    })
  } catch (err) {
    console.error('[GET /api/admin/permissions]', err)
    return serverError()
  }
}

// POST — تحديث صلاحيات أدمن (المالك فقط)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const body   = await req.json()
    const parsed = PermSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { adminId, permissions: rawPermissions } = parsed.data

    const validKeys = new Set<string>(ALL_ADMIN_PERMISSIONS.map((p) => p.key))
    const permissions = rawPermissions.filter((p) => validKeys.has(p))

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    })
    if (!admin || admin.role !== Role.ADMIN) {
      return ok({ error: true, message: 'المستخدم ليس مديراً' })
    }

    // حذف القديم وإنشاء الجديد
    await prisma.$transaction([
      db.adminPermission.deleteMany({ where: { adminId } }),
      db.adminPermission.createMany({
        data: permissions.map((perm: string) => ({
          adminId,
          permission: perm,
          granted:    true,
          grantedBy:  auth.context.userId,
        })),
      }),
    ])

    // إشعار للأدمن
    await prisma.notification.create({
      data: {
        userId: adminId,
        title:  '🔑 تم تحديث صلاحياتك',
        body:   `تم منحك ${permissions.length} صلاحية جديدة من قِبل المالك`,
        type:   'PERMISSIONS_UPDATED',
        data:   { count: permissions.length },
      },
    })

    // تسجيل في ActivityLog
    await prisma.activityLog.create({
      data: {
        actorId:    auth.context.userId,
        action:     ActivityType.CREATE_ADMIN,
        targetType: 'ADMIN_PERMISSIONS',
        targetId:   adminId,
        details:    { permissions },
      },
    })

    return ok({ message: `تم تحديث ${permissions.length} صلاحية` })
  } catch (err) {
    console.error('[POST /api/admin/permissions]', err)
    return serverError()
  }
}
