import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, created, fromAppError, serverError, fromZodError } from '@/lib/api-response'
import { NotFoundError } from '@/core/errors'
import {
  requireFacilityProfile,
  isDoctorInFacility,
  requireDepartmentInFacility,
} from '@/lib/facility/require-facility-profile'

const AssignSchema = z.object({
  doctorId: z.string().uuid(),
  role: z.string().max(100).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const { id: departmentId } = await params
    const department = await requireDepartmentInFacility(auth.facilityId, departmentId)
    if (!department) return fromAppError(new NotFoundError('القسم غير موجود'))

    const assignments = await prisma.departmentDoctorAssignment.findMany({
      where: { departmentId },
      orderBy: { createdAt: 'asc' },
      include: {
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialization: true,
            avatarUrl: true,
            averageRating: true,
          },
        },
      },
    })

    return ok(
      assignments.map((a) => ({
        id: a.id,
        doctorId: a.doctorId,
        role: a.role,
        isActive: a.isActive,
        doctor: {
          id: a.doctor.id,
          firstName: a.doctor.firstName,
          lastName: a.doctor.lastName,
          specialization: a.doctor.specialization,
          avatarUrl: a.doctor.avatarUrl,
          averageRating: Number(a.doctor.averageRating),
        },
      })),
    )
  } catch (err) {
    console.error('[GET /api/facility/departments/[id]/doctors]', err)
    return serverError()
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const { id: departmentId } = await params
    const department = await requireDepartmentInFacility(auth.facilityId, departmentId)
    if (!department) return fromAppError(new NotFoundError('القسم غير موجود'))

    const parsed = AssignSchema.safeParse(await req.json())
    if (!parsed.success) return fromZodError(parsed.error)

    const linked = await isDoctorInFacility(auth.facilityId, parsed.data.doctorId)
    if (!linked) {
      return ok({ error: true, message: 'الطبيب غير مرتبط بمنشأتك' })
    }

    const assignment = await prisma.departmentDoctorAssignment.upsert({
      where: {
        departmentId_doctorId: {
          departmentId,
          doctorId: parsed.data.doctorId,
        },
      },
      create: {
        departmentId,
        doctorId: parsed.data.doctorId,
        role: parsed.data.role,
        isActive: true,
      },
      update: {
        role: parsed.data.role,
        isActive: true,
      },
    })

    return created({ id: assignment.id, doctorId: assignment.doctorId })
  } catch (err) {
    console.error('[POST /api/facility/departments/[id]/doctors]', err)
    return serverError()
  }
}
