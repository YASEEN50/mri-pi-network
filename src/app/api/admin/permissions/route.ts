// src/app/api/admin/permissions/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role, ActivityType } from '@prisma/client'
import { z } from 'zod'

const ALL_PERMISSIONS = [
  { key: 'canApproveDoctor',    label: 'قبول/رفض الأطباء',           category: 'التحقق' },
  { key: 'canRejectDoctor',     label: 'رفض طلبات الأطباء',          category: 'التحقق' },
  { key: 'canApproveFacility',  label: 'قبول/رفض المنشآت',          category: 'التحقق' },
  { key: 'canViewVerification', label: 'عرض طلبات التحقق',           category: 'التحقق' },
  { key: 'canModerateContent',  label: 'مراجعة تقارير المحتوى',     category: 'المحتوى' },
  { key: 'canHideContent',      label: 'إخفاء المحتوى المخالف',     category: 'المحتوى' },
  { key: 'canDeleteReviews',    label: 'حذف التقييمات المسيئة',     category: 'المحتوى' },
  { key: 'canBanUsers',         label: 'حظر المستخدمين',             category: 'المستخدمون' },
  { key: 'canViewUsers',        label: 'عرض بيانات المستخدمين',     category: 'المستخدمون' },
  { key: 'canManageSupport',    label: 'إدارة طلبات الدعم',         category: 'الدعم' },
  { key: 'canViewAnalytics',    label: 'عرض الإحصائيات والتقارير',  category: 'التقارير' },
  { key: 'canAssignTasks',      label: 'إسناد المهام لأدمن آخر',    category: 'الإدارة' },
]

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

    const perms = await db.adminPermission.findMany({
      where: { adminId, granted: true },
      select: { permission: true },
    })

    return ok({
      adminId,
      permissions: perms.map((p: any) => p.permission),
      allPermissions: ALL_PERMISSIONS,
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

    const { adminId, permissions } = parsed.data

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
