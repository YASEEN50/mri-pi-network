import { NextRequest } from 'next/server'
import { ok, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { getAvailableSlots } from '@/lib/appointments/booking'
import { parseDateOnly } from '@/lib/appointments/slots'
import { doctorHasActivePremioByProfileId } from '@/lib/premio/active-premio'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: doctorId } = await params
    const date = req.nextUrl.searchParams.get('date') ?? ''

    if (!parseDateOnly(date)) {
      return ok({ error: true, message: 'تاريخ غير صالح (YYYY-MM-DD)' })
    }

    const doctor = await prisma.doctorProfile.findFirst({
      where: { id: doctorId, deletedAt: null, approvalStatus: 'APPROVED' },
      select: { id: true },
    })
    if (!doctor) return ok({ error: true, message: 'الطبيب غير متاح' })

    const listed = await doctorHasActivePremioByProfileId(doctorId)
    if (!listed) return ok({ error: true, message: 'الطبيب غير متاح للحجز حالياً' })

    const slots = await getAvailableSlots({ date, doctorId })
    return ok(slots)
  } catch (err) {
    console.error('[GET /api/doctors/[id]/slots]', err)
    return serverError()
  }
}
