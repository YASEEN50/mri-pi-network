import { NextRequest } from 'next/server'
import { InstantConsultStatus, Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import {
  createChatRoomForInstantConsult,
  doctorHasActiveInstantSession,
  notifyClientInstantAccepted,
} from '@/lib/instant-consult/service'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { id: true, firstName: true, lastName: true, instantConsultDurationMinutes: true, isOnlineForInstant: true },
    })
    if (!doctor) return ok({ error: true, message: 'ملف الطبيب غير موجود' })
    if (!doctor.isOnlineForInstant) return ok({ error: true, message: 'فعّل «متاح الآن» أولاً' })

    const request = await prisma.instantConsultRequest.findFirst({
      where: { id, doctorId: doctor.id, status: InstantConsultStatus.PENDING },
      include: { client: { select: { id: true, userId: true } } },
    })
    if (!request) return ok({ error: true, message: 'الطلب غير موجود أو انتهت مهلة القبول' })
    if (request.expiresAt && request.expiresAt <= new Date()) {
      await prisma.instantConsultRequest.update({
        where: { id },
        data: { status: InstantConsultStatus.EXPIRED },
      })
      return ok({ error: true, message: 'انتهت مهلة قبول الطلب' })
    }

    if (await doctorHasActiveInstantSession(doctor.id, id)) {
      return ok({ error: true, message: 'لديك استشارة نشطة أخرى' })
    }

    const chatRoomId = await createChatRoomForInstantConsult(request.clientId, doctor.id)
    const now = new Date()
    const sessionEndsAt = new Date(now.getTime() + doctor.instantConsultDurationMinutes * 60 * 1000)

    await prisma.instantConsultRequest.update({
      where: { id },
      data: {
        status: InstantConsultStatus.ACCEPTED,
        acceptedAt: now,
        chatRoomId,
        sessionEndsAt,
      },
    })

    await notifyClientInstantAccepted(
      request.client.userId,
      id,
      `د. ${doctor.firstName} ${doctor.lastName}`,
    )

    return ok({ id, chatRoomId, sessionEndsAt: sessionEndsAt.toISOString() })
  } catch (err) {
    console.error('[POST /api/instant-consult/[id]/accept]', err)
    return serverError()
  }
}
