import { NextRequest } from 'next/server'
import { Role, AppointmentStatus } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { cancelRemindersForAppointment } from '@/lib/cron/reminders.service'
import { z } from 'zod'

const UpdateStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']),
  cancelReason: z.string().optional(),
  doctorNotes: z.string().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    if (!appointment) return ok({ error: true, message: 'الموعد غير موجود' })

    if (status === AppointmentStatus.CANCELLED && role === Role.CLIENT && appointment.clientId !== userId) {
      return ok({ error: true, message: 'لا يمكنك إلغاء موعد لا يخصك' })
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status,
        ...(cancelReason && { cancelReason }),
        ...(doctorNotes  && { doctorNotes }),
        ...(status === AppointmentStatus.CANCELLED && { cancelledBy: userId }),
        updatedAt: new Date(),
      },
    })

    // إلغاء التذكيرات عند إلغاء الموعد
    if (status === 'CANCELLED') {
      cancelRemindersForAppointment(id).catch(console.error)
    }

    return ok({ id: updated.id, status: updated.status })
  } catch (err) {
    console.error('[PUT /api/appointments/[id]/status]', err)
    return serverError()
  }
}