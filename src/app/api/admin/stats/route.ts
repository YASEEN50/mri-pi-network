import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewAnalytics)
    if (!auth.success) return fromAppError(auth.error)

    const [
      totalUsers, totalDoctors, totalClients, totalFacilities,
      pendingDoctors, pendingFacilities,       pendingPublications, totalAppointments,
      completedAppointments, totalReviews, platformRevenue,
    ] = await prisma.$transaction([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.doctorProfile.count({ where: { deletedAt: null } }),
      prisma.clientProfile.count({ where: { deletedAt: null } }),
      prisma.facilityProfile.count({ where: { deletedAt: null } }),
      prisma.doctorProfile.count({
        where: {
          approvalStatus: { in: ['PENDING', 'DOCUMENTS_REVIEW'] },
          deletedAt: null,
        },
      }),
      prisma.facilityProfile.count({
        where: {
          approvalStatus: { in: ['PENDING', 'DOCUMENTS_REVIEW'] },
          deletedAt: null,
        },
      }),
      prisma.publication.count({
        where: { status: 'PENDING_REVIEW', deletedAt: null },
      }),
      prisma.appointment.count({ where: { deletedAt: null } }),
      prisma.appointment.count({ where: { status: 'COMPLETED', deletedAt: null } }),
      prisma.review.count({ where: { deletedAt: null } }),
      prisma.transaction.aggregate({
        where: { status: 'COMPLETED' },
        _sum:  { platformFee: true },
      }),
    ])

    return ok({
      totalUsers, totalDoctors, totalClients, totalFacilities,
      pendingDoctors, pendingFacilities, pendingPublications, totalAppointments,
      completedAppointments, totalReviews,
      platformRevenue: Number(platformRevenue._sum.platformFee ?? 0),
    })
  } catch (err) {
    console.error('[GET /api/admin/stats]', err)
    return serverError()
  }
}
