import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, serverError, fromZodError } from '@/lib/api-response'
import { NotFoundError } from '@/core/errors'
import { requireFacilityProfile } from '@/lib/facility/require-facility-profile'

const PatchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  nameEn: z.string().max(120).optional(),
  icon: z.string().max(8).optional(),
  floor: z.string().max(50).optional(),
  phone: z.string().max(30).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const existing = await prisma.facilityDepartment.findFirst({
      where: { id, facilityId: auth.facilityId },
    })
    if (!existing) return fromAppError(new NotFoundError('القسم غير موجود'))

    const parsed = PatchSchema.safeParse(await req.json())
    if (!parsed.success) return fromZodError(parsed.error)

    const updated = await prisma.facilityDepartment.update({
      where: { id },
      data: parsed.data,
    })

    return ok({ id: updated.id, isActive: updated.isActive })
  } catch (err) {
    console.error('[PATCH /api/facility/departments/[id]]', err)
    return serverError()
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const existing = await prisma.facilityDepartment.findFirst({
      where: { id, facilityId: auth.facilityId },
    })
    if (!existing) return fromAppError(new NotFoundError('القسم غير موجود'))

    await prisma.facilityDepartment.delete({ where: { id } })
    return ok({ deleted: true })
  } catch (err) {
    console.error('[DELETE /api/facility/departments/[id]]', err)
    return serverError()
  }
}
