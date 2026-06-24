import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import {
  canAccessVideoCall,
  getJitsiEmbedUrl,
  getJitsiServerUrl,
  getVideoRoomName,
  isOnlineBookingEnabled,
} from '@/lib/appointments/online-video'

async function canViewAppointment(
  appointment: { clientId: string; doctorId: string | null },
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
  return role === Role.ADMIN || role === Role.OWNER
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isOnlineBookingEnabled()) {
      return ok({ error: true, message: 'الاستشارات عن بعد غير مفعّلة حالياً' })
    }

    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const appointment = await prisma.appointment.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: {
          select: {
            email: true,
            piUsername: true,
            clientProfile: { select: { firstName: true, lastName: true } },
          },
        },
        doctor: { select: { firstName: true, lastName: true, userId: true } },
      },
    })

    if (!appointment) return ok({ error: true, message: 'الموعد غير موجود' })

    const allowed = await canViewAppointment(
      appointment,
      auth.context.role,
      auth.context.userId,
    )
    if (!allowed) return ok({ error: true, message: 'غير مصرح' })

    const access = canAccessVideoCall({
      type: appointment.type,
      status: appointment.status,
      scheduledAt: appointment.scheduledAt,
      duration: appointment.duration,
    })

    const isDoctor = auth.context.role === Role.DOCTOR
    const clientName = appointment.client.clientProfile
      ? `${appointment.client.clientProfile.firstName} ${appointment.client.clientProfile.lastName}`
      : appointment.client.piUsername ?? appointment.client.email ?? 'مريض'
    const doctorName = appointment.doctor
      ? `د. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`
      : 'طبيب'

    const displayName = isDoctor ? doctorName : clientName
    const roomName = getVideoRoomName(appointment.id)

    return ok({
      appointmentId: appointment.id,
      canJoin: access.allowed,
      reason: access.reason ?? null,
      roomName,
      serverUrl: getJitsiServerUrl(),
      embedUrl: access.allowed ? getJitsiEmbedUrl(roomName, displayName) : null,
      displayName,
      scheduledAt: appointment.scheduledAt,
      duration: appointment.duration,
    })
  } catch (err) {
    console.error('[GET /api/appointments/[id]/video]', err)
    return serverError()
  }
}
