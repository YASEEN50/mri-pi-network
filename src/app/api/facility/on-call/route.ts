import { NextRequest } from 'next/server'
import { z } from 'zod'
import { OnCallShiftType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ok, created, fromAppError, serverError, fromZodError } from '@/lib/api-response'
import { NotFoundError } from '@/core/errors'
import { requireFacilityProfile, isDoctorInFacility, isDoctorAssignedToDepartment } from '@/lib/facility/require-facility-profile'
import { validateOnCallWindow } from '@/lib/facility/on-call-validation'

const CreateSchema = z.object({
  departmentId: z.string().uuid(),
  doctorId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  shiftType: z.nativeEnum(OnCallShiftType).default(OnCallShiftType.MORNING),
  notes: z.string().max(500).optional(),
  isPublished: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const departmentId = searchParams.get('departmentId')

    const now = new Date()
    const rangeFrom = from ? new Date(from) : now
    const rangeTo = to
      ? new Date(to)
      : new Date(rangeFrom.getTime() + 14 * 24 * 60 * 60 * 1000)

    const shifts = await prisma.onCallShift.findMany({
      where: {
        facilityId: auth.facilityId,
        ...(departmentId ? { departmentId } : {}),
        startsAt: { lt: rangeTo },
        endsAt: { gt: rangeFrom },
      },
      orderBy: { startsAt: 'asc' },
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
    })

    return ok(
      shifts.map((s) => ({
        id: s.id,
        departmentId: s.departmentId,
        department: s.department,
        doctorId: s.doctorId,
        doctor: {
          id: s.doctor.id,
          fullName: `د. ${s.doctor.firstName} ${s.doctor.lastName}`,
          specialization: s.doctor.specialization,
          avatarUrl: s.doctor.avatarUrl,
        },
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        shiftType: s.shiftType,
        notes: s.notes,
        isPublished: s.isPublished,
        isActiveNow: s.startsAt <= now && s.endsAt > now,
      })),
    )
  } catch (err) {
    console.error('[GET /api/facility/on-call]', err)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const parsed = CreateSchema.safeParse(await req.json())
    if (!parsed.success) return fromZodError(parsed.error)

    const startsAt = new Date(parsed.data.startsAt)
    const endsAt = new Date(parsed.data.endsAt)
    const windowError = validateOnCallWindow(startsAt, endsAt)
    if (windowError) return ok({ error: true, message: windowError })

    const department = await prisma.facilityDepartment.findFirst({
      where: { id: parsed.data.departmentId, facilityId: auth.facilityId, isActive: true },
    })
    if (!department) return ok({ error: true, message: 'القسم غير موجود أو غير نشط' })

    const linked = await isDoctorInFacility(auth.facilityId, parsed.data.doctorId)
    if (!linked) {
      return ok({ error: true, message: 'الطبيب غير مرتبط بمنشأتك' })
    }

    const assigned = await isDoctorAssignedToDepartment(parsed.data.departmentId, parsed.data.doctorId)
    if (!assigned) {
      return ok({ error: true, message: 'الطبيب غير معيّن لهذا القسم — اربطه من صفحة أطباء الأقسام' })
    }

    const shift = await prisma.onCallShift.create({
      data: {
        facilityId: auth.facilityId,
        departmentId: parsed.data.departmentId,
        doctorId: parsed.data.doctorId,
        startsAt,
        endsAt,
        shiftType: parsed.data.shiftType,
        notes: parsed.data.notes,
        isPublished: parsed.data.isPublished ?? true,
      },
    })

    return created({ id: shift.id })
  } catch (err) {
    console.error('[POST /api/facility/on-call]', err)
    return serverError()
  }
}
