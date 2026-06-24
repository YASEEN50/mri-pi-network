// src/lib/admin/permissions.ts
// Granular admin permissions — OWNER bypasses; ADMIN checked against AdminPermission table

import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  requireAuth,
  type AuthSuccess,
  type AuthFailure,
} from '@/infrastructure/auth/providers/role-guard'
import { UnauthorizedError } from '@/core/errors'

export const ALL_ADMIN_PERMISSIONS = [
  { key: 'canApproveDoctor', label: 'قبول/رفض الأطباء', category: 'التحقق' },
  { key: 'canRejectDoctor', label: 'رفض طلبات الأطباء', category: 'التحقق' },
  { key: 'canApproveFacility', label: 'قبول/رفض المنشآت', category: 'التحقق' },
  { key: 'canViewVerification', label: 'عرض طلبات التحقق', category: 'التحقق' },
  { key: 'canModerateContent', label: 'مراجعة تقارير المحتوى', category: 'المحتوى' },
  { key: 'canHideContent', label: 'إخفاء المحتوى المخالف', category: 'المحتوى' },
  { key: 'canDeleteReviews', label: 'حذف التقييمات المسيئة', category: 'المحتوى' },
  { key: 'canBanUsers', label: 'حظر المستخدمين', category: 'المستخدمون' },
  { key: 'canViewUsers', label: 'عرض بيانات المستخدمين', category: 'المستخدمون' },
  { key: 'canManageSupport', label: 'إدارة طلبات الدعم', category: 'الدعم' },
  { key: 'canViewAnalytics', label: 'عرض الإحصائيات والتقارير', category: 'التقارير' },
  { key: 'canAssignTasks', label: 'إسناد المهام لأدمن آخر', category: 'الإدارة' },
] as const

export type AdminPermissionKey = (typeof ALL_ADMIN_PERMISSIONS)[number]['key']

export const ADMIN_PERMISSION_KEYS = Object.fromEntries(
  ALL_ADMIN_PERMISSIONS.map((p) => [p.key, p.key])
) as Record<AdminPermissionKey, AdminPermissionKey>

/** OWNER always allowed. ADMIN with no rows keeps legacy full access until owner assigns permissions. */
export async function hasAdminPermission(
  userId: string,
  role: Role,
  permission: AdminPermissionKey
): Promise<boolean> {
  if (role === Role.OWNER) return true
  if (role !== Role.ADMIN) return false

  const granted = await prisma.adminPermission.findMany({
    where: { adminId: userId, granted: true },
    select: { permission: true },
  })

  if (granted.length === 0) return true

  return granted.some((g) => g.permission === permission)
}

export async function requireAdminPermission(
  permission: AdminPermissionKey
): Promise<AuthSuccess | AuthFailure> {
  const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
  if (!auth.success) return auth

  const allowed = await hasAdminPermission(auth.context.userId, auth.context.role, permission)
  if (!allowed) {
    return {
      success: false,
      error: new UnauthorizedError('ليس لديك الصلاحية لهذا الإجراء'),
    }
  }

  return auth
}

export async function requireDoctorDecisionPermission(
  action: 'approve' | 'reject'
): Promise<AuthSuccess | AuthFailure> {
  const permission =
    action === 'approve' ? ADMIN_PERMISSION_KEYS.canApproveDoctor : ADMIN_PERMISSION_KEYS.canRejectDoctor
  return requireAdminPermission(permission)
}

export async function requireVerificationReviewPermission(
  decision: 'APPROVE' | 'REJECT'
): Promise<AuthSuccess | AuthFailure> {
  const permission =
    decision === 'APPROVE'
      ? ADMIN_PERMISSION_KEYS.canApproveDoctor
      : ADMIN_PERMISSION_KEYS.canRejectDoctor
  return requireAdminPermission(permission)
}
