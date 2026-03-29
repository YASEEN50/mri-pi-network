// =============================================================================
// src/app/api/appointments/[id]/status/route.ts
// PUT /api/appointments/[id]/status
// =============================================================================

import { NextRequest } from 'next/server'
import { Role, AppointmentStatus } from '@prisma/client'
import { container } from '@/infrastructure'
import { requireAuth } from '@/infrastructure/auth/providers/email-auth.provider'
import { ok, fromAppError, parseBody, serverError } from '@/lib/api-response'
import { UpdateAppointmentStatusSchema } from '@/lib/validations/doctor.schema'
import { NotFoundError, ForbiddenError, BusinessRuleError } from '@/core/errors'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const appointment = await container.appointmentRepo.findById(params.id)
    if (!appointment) return fromAppError(new NotFoundError('الموعد', params.id))

    const body = await req.json()
    const parsed = parseBody(UpdateAppointmentStatusSchema, body)
    if (!parsed.success) return parsed.response

    const { status, cancelReason, doctorNotes } = parsed.data
    const { role, userId } = auth.context

    // صلاحيات التحديث حسب الدور والحالة
    if (status === AppointmentStatus.CANCELLED) {
      if (!appointment.canBeCancelled()) {
        return fromAppError(new BusinessRuleError('لا يمكن إلغاء هذا الموعد'))
      }
      if (role === Role.CLIENT && appointment.clientId !== userId) {
        return fromAppError(new ForbiddenError('لا يمكنك إلغاء موعد لا يخصك'))
      }
    }

    if (status === AppointmentStatus.CONFIRMED && role !== Role.DOCTOR && role !== Role.FACILITY) {
      return fromAppError(new ForbiddenError('فقط الطبيب أو المنشأة يمكنهم تأكيد الموعد'))
    }

    if (status === AppointmentStatus.COMPLETED && role !== Role.DOCTOR && role !== Role.FACILITY) {
      return fromAppError(new ForbiddenError('فقط الطبيب أو المنشأة يمكنهم إتمام الموعد'))
    }

    const updated = await container.appointmentRepo.updateStatus(
      params.id,
      status,
      {
        cancelledBy: status === AppointmentStatus.CANCELLED ? userId : undefined,
        cancelReason,
        doctorNotes,
      }
    )

    // تحديث إحصائيات الطبيب عند اكتمال الموعد
    if (status === AppointmentStatus.COMPLETED && appointment.doctorId) {
      await container.doctorRepo.updateStats(appointment.doctorId, {
        totalAppointments: (await container.appointmentRepo.findMany({
          doctorId: appointment.doctorId,
          status: AppointmentStatus.COMPLETED,
        })).total,
      })
    }

    return ok({ id: updated.id, status: updated.status })
  } catch (err) {
    console.error('[PUT /api/appointments/[id]/status]', err)
    return serverError()
  }
}
