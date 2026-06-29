// GET — قائمة المراجعين (ADMIN + OWNER) لإسناد طلبات التحقق

import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'

export async function GET() {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewVerification)
    if (!auth.success) return fromAppError(auth.error)

    const reviewers = await db.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.OWNER] },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        adminProfile: { select: { role: true } },
      },
      orderBy: { email: 'asc' },
    })

    return ok(
      reviewers.map((u) => ({
        id:    u.id,
        email: u.email,
        role:  u.role,
        name:  u.email ?? u.id.slice(0, 8),
      })),
    )
  } catch (err) {
    console.error('[GET /api/admin/reviewers]', err)
    return serverError()
  }
}
