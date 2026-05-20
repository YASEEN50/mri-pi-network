// src/app/api/admin/doctors/pending/route.ts
import { NextRequest } from 'next/server'
import { Role, ApprovalStatus } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const page  = Number(req.nextUrl.searchParams.get('page')  ?? 1)
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 20)
    const skip  = (page - 1) * limit

    const [doctors, total] = await Promise.all([
      prisma.doctorProfile.findMany({
        where: { approvalStatus: ApprovalStatus.PENDING, deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          specialization: true,
          licenseNumber: true,
          approvalStatus: true,
          city: true,
          phone: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
      prisma.doctorProfile.count({
        where: { approvalStatus: ApprovalStatus.PENDING, deletedAt: null },
      }),
    ])

    return ok(
      doctors.map((d: any) => ({
        id: d.id,
        fullName: `${d.firstName} ${d.lastName}`,
        specialization: d.specialization,
        licenseNumber: d.licenseNumber,
        approvalStatus: d.approvalStatus,
        city: d.city,
        phone: d.phone,
        email: d.user.email,
        createdAt: d.createdAt,
      })),
      { total, page, limit }
    )
  } catch (err) {
    console.error('[GET /api/admin/doctors/pending]', err)
    return serverError()
  }
}
