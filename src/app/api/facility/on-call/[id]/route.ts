import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { NotFoundError } from '@/core/errors'
import { requireFacilityProfile } from '@/lib/facility/require-facility-profile'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const shift = await prisma.onCallShift.findFirst({
      where: { id, facilityId: auth.facilityId },
    })
    if (!shift) return fromAppError(new NotFoundError('المناوبة غير موجودة'))

    await prisma.onCallShift.delete({ where: { id } })
    return ok({ deleted: true })
  } catch (err) {
    console.error('[DELETE /api/facility/on-call/[id]]', err)
    return serverError()
  }
}
