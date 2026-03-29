// =============================================================================
// src/app/api/appointments/route.ts
// GET /api/appointments
// POST /api/appointments
// =============================================================================

import { NextRequest } from 'next/server'
import { Role, AppointmentStatus } from '@prisma/client'
import { container } from '@/infrastructure'
import { requireAuth } from '@/infrastructure/auth/providers/email-auth.provider'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { CreateAppointmentSchema, AppointmentFiltersSchema } from '@/lib/validations/doctor.schema'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const sp = req.nextUrl.searchParams
    const parsed = AppointmentFiltersSchema.safeParse(Object.fromEntries(sp))
    const filters = parsed.success ? parsed.data : { page: 1, limit: 20 }

    // تصفية حسب الدور
    const roleFilter: Record<string, string> = {}
    if (auth.context.role === Role.CLIENT)   roleFilter.clientId   = auth.context.userId
    if (auth.context.role === Role.DOCTOR) {
      const doctor = await container.doctorRepo.findByUserId(auth.context.userId)
      if (doctor) roleFilter.doctorId = doctor.id
    }
    if (auth.context.role === Role.FACILITY) {
      const facility = await container.facilityRepo.findByUserId(auth.context.userId)
      if (facility) roleFilter.facilityId = facility.id
    }

    const result = await container.appointmentRepo.findMany({
      ...roleFilter,
      status: filters.status as AppointmentStatus | undefined,
      fromDate: filters.fromDate ? new Date(filters.fromDate) : undefined,
      toDate: filters.toDate ? new Date(filters.toDate) : undefined,
      page: filters.page,
      limit: filters.limit,
    })

    return ok(
      result.appointments.map((a) => ({
        id: a.id,
        status: a.status,
        type: a.type,
        scheduledAt: a.scheduledAt,
        duration: a.duration,
        reason: a.reason,
        fee: a.fee,
        isPaid: a.isPaid,
        doctorId: a.doctorId,
        facilityId: a.facilityId,
      })),
      { total: result.total, page: filters.page, limit: filters.limit }
    )
  } catch (err) {
    console.error('[GET /api/appointments]', err)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.CLIENT] })
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = CreateAppointmentSchema.safeParse(body)
    if (!parsed.success) {
      const { fromZodError } = await import('@/lib/api-response')
      return fromZodError(parsed.error)
    }

    const result = await container.createAppointment.execute({
      clientId: auth.context.userId,
      doctorId: parsed.data.doctorId,
      facilityId: parsed.data.facilityId,
      type: parsed.data.type,
      scheduledAt: new Date(parsed.data.scheduledAt),
      duration: parsed.data.duration,
      reason: parsed.data.reason,
      notes: parsed.data.notes,
    })

    if (!result.success) return fromAppError(result.error)

    return created({
      id: result.data.id,
      status: result.data.status,
      scheduledAt: result.data.scheduledAt,
      message: 'تم حجز الموعد بنجاح',
    })
  } catch (err) {
    console.error('[POST /api/appointments]', err)
    return serverError()
  }
}
