import { NextRequest } from 'next/server'
import { ok, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { getAvailableSlots } from '@/lib/appointments/booking'
import { parseDateOnly } from '@/lib/appointments/slots'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: facilityId } = await params
    const date = req.nextUrl.searchParams.get('date') ?? ''

    if (!parseDateOnly(date)) {
      return ok({ error: true, message: 'تاريخ غير صالح (YYYY-MM-DD)' })
    }

    const facility = await prisma.facilityProfile.findFirst({
      where: { id: facilityId, deletedAt: null, approvalStatus: 'APPROVED' },
      select: { id: true },
    })
    if (!facility) return ok({ error: true, message: 'المنشأة غير متاحة' })

    const slots = await getAvailableSlots({ date, facilityId })
    return ok(slots)
  } catch (err) {
    console.error('[GET /api/facilities/[id]/slots]', err)
    return serverError()
  }
}
