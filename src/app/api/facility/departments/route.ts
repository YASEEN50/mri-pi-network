import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, created, fromAppError, serverError, fromZodError } from '@/lib/api-response'
import { DEFAULT_HOSPITAL_DEPARTMENTS } from '@/lib/facility/department-catalog'
import { requireFacilityProfile } from '@/lib/facility/require-facility-profile'

const CreateSchema = z.object({
  name: z.string().min(2).max(120),
  nameEn: z.string().max(120).optional(),
  icon: z.string().max(8).optional(),
  floor: z.string().max(50).optional(),
  phone: z.string().max(30).optional(),
  code: z.string().max(40).optional(),
})

export async function GET() {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const departments = await prisma.facilityDepartment.findMany({
      where: { facilityId: auth.facilityId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { onCallShifts: true, doctors: true } },
      },
    })

    return ok(
      departments.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        nameEn: d.nameEn,
        icon: d.icon,
        floor: d.floor,
        phone: d.phone,
        isActive: d.isActive,
        sortOrder: d.sortOrder,
        shiftsCount: d._count.onCallShifts,
        doctorsCount: d._count.doctors,
      })),
    )
  } catch (err) {
    console.error('[GET /api/facility/departments]', err)
    return serverError()
  }
}

/** Seed default hospital departments (idempotent) */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json().catch(() => ({}))
    const action = body?.action as string | undefined

    if (action === 'seed_defaults') {
      const existing = await prisma.facilityDepartment.count({
        where: { facilityId: auth.facilityId },
      })
      if (existing > 0) {
        return ok({ message: 'الأقسام موجودة مسبقاً', seeded: 0 })
      }

      await prisma.facilityDepartment.createMany({
        data: DEFAULT_HOSPITAL_DEPARTMENTS.map((t) => ({
          facilityId: auth.facilityId,
          code: t.code,
          name: t.name,
          nameEn: t.nameEn,
          icon: t.icon,
          sortOrder: t.sortOrder,
          isActive: true,
        })),
      })

      return created({ seeded: DEFAULT_HOSPITAL_DEPARTMENTS.length })
    }

    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const dept = await prisma.facilityDepartment.create({
      data: {
        facilityId: auth.facilityId,
        ...parsed.data,
      },
    })

    return created({ id: dept.id })
  } catch (err) {
    console.error('[POST /api/facility/departments]', err)
    return serverError()
  }
}
