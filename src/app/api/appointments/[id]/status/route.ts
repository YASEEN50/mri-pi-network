import { NextRequest } from 'next/server'
import { Role, AppointmentStatus } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { cancelRemindersForAppointment } from '@/lib/cron/reminders.service'
import {
  notifyAppointmentConfirmed,
  notifyAppointmentCancelled,
} from '@/lib/appointments/notifications'
import { notifyReviewRequested } from '@/lib/reviews/notifications'
import { z } from 'zod'

const UpdateStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']),
  cancelReason: z.string().optional(),
  doctorNotes: z.string().optional(),
})

async function canManageAppointment(
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

  return false
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = UpdateStatusSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { status, cancelReason, doctorNotes } = parsed.data
    const { role, userId } = auth.context

    const appointment = await prisma.appointment.findUnique({ where: { id } })
    if (!appointment || appointment.deletedAt) {
      return ok({ error: true, message: 'الموعد غير موجود' })
    }

    const allowed = await canManageAppointment(appointment, role, userId)
    if (!allowed) return ok({ error: true, message: 'غير مصرح بتعديل هذا الموعد' })

    if (status === AppointmentStatus.CONFIRMED && role === Role.CLIENT) {
      return ok({ error: true, message: 'فقط الطبيب أو المنشأة يمكنهم تأكيد الموعد' })
    }

    if (status === AppointmentStatus.CANCELLED && role === Role.CLIENT && appointment.clientId !== userId) {
      return ok({ error: true, message: 'لا يمكنك إلغاء موعد لا يخصك' })
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status,
        ...(cancelReason && { cancelReason }),
        ...(doctorNotes && { doctorNotes }),
        ...(status === AppointmentStatus.CANCELLED && { cancelledBy: userId }),
        updatedAt: new Date(),
      },
    })

    if (status === AppointmentStatus.CANCELLED) {
      cancelRemindersForAppointment(id).catch(console.error)
      notifyAppointmentCancelled(id).catch(console.error)
    }

    if (status === AppointmentStatus.CONFIRMED) {
      notifyAppointmentConfirmed(id).catch(console.error)
    }

    if (status === AppointmentStatus.COMPLETED) {
      notifyReviewRequested(id).catch(console.error)
    }

    return ok({ id: updated.id, status: updated.status })
  } catch (err) {
    console.error('[PUT /api/appointments/[id]/status]', err)
    return serverError()
  }
}
