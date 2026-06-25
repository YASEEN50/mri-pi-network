import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, serverError, fromZodError } from '@/lib/api-response'
import { NotFoundError } from '@/core/errors'
import { requireFacilityProfile, requireDepartmentInFacility } from '@/lib/facility/require-facility-profile'

const PatchSchema = z.object({
  role: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; doctorId: string }> },
) {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const { id: departmentId, doctorId } = await params
    const department = await requireDepartmentInFacility(auth.facilityId, departmentId)
    if (!department) return fromAppError(new NotFoundError('القسم غير موجود'))

    const existing = await prisma.departmentDoctorAssignment.findUnique({
      where: { departmentId_doctorId: { departmentId, doctorId } },
    })
    if (!existing) return fromAppError(new NotFoundError('التعيين غير موجود'))

    const parsed = PatchSchema.safeParse(await req.json())
    if (!parsed.success) return fromZodError(parsed.error)

    const updated = await prisma.departmentDoctorAssignment.update({
      where: { id: existing.id },
      data: parsed.data,
    })

    return ok({ id: updated.id, isActive: updated.isActive, role: updated.role })
  } catch (err) {
    console.error('[PATCH /api/facility/departments/[id]/doctors/[doctorId]]', err)
    return serverError()
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; doctorId: string }> },
) {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const { id: departmentId, doctorId } = await params
    const department = await requireDepartmentInFacility(auth.facilityId, departmentId)
    if (!department) return fromAppError(new NotFoundError('القسم غير موجود'))

    const existing = await prisma.departmentDoctorAssignment.findUnique({
      where: { departmentId_doctorId: { departmentId, doctorId } },
    })
    if (!existing) return fromAppError(new NotFoundError('التعيين غير موجود'))

    await prisma.departmentDoctorAssignment.delete({ where: { id: existing.id } })
    return ok({ deleted: true })
  } catch (err) {
    console.error('[DELETE /api/facility/departments/[id]/doctors/[doctorId]]', err)
    return serverError()
  }
}
