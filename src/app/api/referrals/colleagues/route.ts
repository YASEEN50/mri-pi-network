import { NextRequest } from 'next/server'
import { Role, ApprovalStatus } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

/** Approved colleagues for referral (excludes self) */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { id: true },
    })
    if (!doctor) return ok([])

    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 20), 50)

    const doctors = await prisma.doctorProfile.findMany({
      where: {
        id: { not: doctor.id },
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
        ...(q && {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { specialization: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
      take: limit,
      orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        specialization: true,
        city: true,
        averageRating: true,
      },
    })

    return ok(
      doctors.map(d => ({
        id: d.id,
        name: `د. ${d.firstName} ${d.lastName}`,
        specialization: d.specialization,
        city: d.city,
        averageRating: Number(d.averageRating),
      })),
    )
  } catch (err) {
    console.error('[GET /api/referrals/colleagues]', err)
    return serverError()
  }
}
