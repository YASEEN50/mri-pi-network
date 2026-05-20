import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const [
      totalUsers, totalDoctors, totalClients, totalFacilities,
      pendingDoctors, pendingFacilities, totalAppointments,
      completedAppointments, totalReviews,
    ] = await prisma.$transaction([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.doctorProfile.count({ where: { deletedAt: null } }),
      prisma.clientProfile.count({ where: { deletedAt: null } }),
      prisma.facilityProfile.count({ where: { deletedAt: null } }),
      prisma.doctorProfile.count({ where: { approvalStatus: 'DOCUMENTS_REVIEW', deletedAt: null } }),
      prisma.facilityProfile.count({ where: { approvalStatus: 'DOCUMENTS_REVIEW', deletedAt: null } }),
      prisma.appointment.count({ where: { deletedAt: null } }),
      prisma.appointment.count({ where: { status: 'COMPLETED', deletedAt: null } }),
      prisma.review.count({ where: { deletedAt: null } }),
    ])

    return ok({
      totalUsers, totalDoctors, totalClients, totalFacilities,
      pendingDoctors, pendingFacilities, totalAppointments,
      completedAppointments, totalReviews,
    })
  } catch (err) {
    console.error('[GET /api/admin/stats]', err)
    return serverError()
  }
}
