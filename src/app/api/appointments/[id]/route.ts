import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

async function canViewAppointment(
  appointment: { clientId: string; doctorId: string | null; facilityId: string | null },
  role: Role,
  userId: string,
): Promise<boolean> {
  if (role === Role.CLIENT) return appointment.clientId === userId

  if (role === Role.DOCTOR && appointment.doctorId) {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId },
      select: { id: true },
    })
    return doctor?.id === appointment.doctorId
  }

  if (role === Role.FACILITY && appointment.facilityId) {
    const facility = await prisma.facilityProfile.findUnique({
      where: { userId },
      select: { id: true },
    })
    return facility?.id === appointment.facilityId
  }

  return role === Role.ADMIN || role === Role.OWNER
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const appointment = await prisma.appointment.findFirst({
      where: { id, deletedAt: null },
      include: {
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialization: true,
            avatarUrl: true,
          },
        },
        facility: { select: { id: true, name: true } },
        review: { select: { id: true, rating: true } },
      },
    })

    if (!appointment) return ok({ error: true, message: 'الموعد غير موجود' })

    const allowed = await canViewAppointment(
      appointment,
      auth.context.role,
      auth.context.userId,
    )
    if (!allowed) return ok({ error: true, message: 'غير مصرح' })

    return ok({
      id:           appointment.id,
      status:       appointment.status,
      type:         appointment.type,
      scheduledAt:  appointment.scheduledAt,
      duration:     appointment.duration,
      reason:       appointment.reason,
      doctorId:     appointment.doctorId,
      facilityId:   appointment.facilityId,
      doctor: appointment.doctor
        ? `د. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`
        : null,
      doctorDetails: appointment.doctor,
      facility:     appointment.facility?.name ?? null,
      hasReview:    !!appointment.review,
      reviewRating: appointment.review?.rating ?? null,
      canReview:
        auth.context.role === Role.CLIENT &&
        appointment.status === 'COMPLETED' &&
        !!appointment.doctorId &&
        !appointment.review,
    })
  } catch (err) {
    console.error('[GET /api/appointments/[id]]', err)
    return serverError()
  }
}
