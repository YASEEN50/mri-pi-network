import { NextRequest } from 'next/server'
import { ApprovalStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'

/** Public: departments + current on-call doctors for a facility */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const now = new Date()

    const facility = await prisma.facilityProfile.findFirst({
      where: { id, deletedAt: null, approvalStatus: ApprovalStatus.APPROVED },
      select: { id: true, name: true },
    })
    if (!facility) return ok({ departments: [], onCallNow: [] })

    const onlyActive = req.nextUrl.searchParams.get('activeOnly') !== 'false'

    const departments = await prisma.facilityDepartment.findMany({
      where: {
        facilityId: id,
        ...(onlyActive ? { isActive: true } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        nameEn: true,
        icon: true,
        floor: true,
        phone: true,
      },
    })

    const onCallNow = await prisma.onCallShift.findMany({
      where: {
        facilityId: id,
        isPublished: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      include: {
        department: { select: { id: true, name: true, icon: true } },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialization: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    })

    return ok({
      facilityId: facility.id,
      facilityName: facility.name,
      departments,
      onCallNow: onCallNow.map((s) => ({
        shiftId: s.id,
        department: s.department,
        doctor: {
          id: s.doctor.id,
          fullName: `د. ${s.doctor.firstName} ${s.doctor.lastName}`,
          specialization: s.doctor.specialization,
          avatarUrl: s.doctor.avatarUrl,
        },
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        shiftType: s.shiftType,
      })),
    })
  } catch (err) {
    console.error('[GET /api/facilities/[id]/departments]', err)
    return serverError()
  }
}
