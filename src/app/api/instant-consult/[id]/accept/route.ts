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
import { refundInstantConsultPayment, settleInstantConsultOnAccept } from '@/lib/payment/instant-consult-escrow'

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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        specialization: true,
        instantConsultDurationMinutes: true,
        isOnlineForInstant: true,
      },
    })
    if (!doctor) return ok({ error: true, message: 'ملف الطبيب غير موجود' })
    if (!doctor.isOnlineForInstant) return ok({ error: true, message: 'فعّل «متاح الآن» أولاً' })

    const request = await prisma.instantConsultRequest.findFirst({
      where: {
        id,
        status: InstantConsultStatus.PENDING,
        OR: [
          { doctorId: doctor.id },
          {
            isBroadcast: true,
            doctorId: null,
            targetSpecialization: {
              contains: doctor.specialization,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: { client: { select: { id: true, userId: true } } },
    })
    if (!request) return ok({ error: true, message: 'الطلب غير موجود أو انتهت مهلة القبول' })

    if (request.expiresAt && request.expiresAt <= new Date()) {
      await prisma.instantConsultRequest.update({
        where: { id },
        data: { status: InstantConsultStatus.EXPIRED },
      })
      await refundInstantConsultPayment(id)
      return ok({ error: true, message: 'انتهت مهلة قبول الطلب — تم استرداد المبلغ للمريض' })
    }

    if (await doctorHasActiveInstantSession(doctor.id, id)) {
      return ok({ error: true, message: 'لديك استشارة نشطة أخرى' })
    }

    const chatRoomId = await createChatRoomForInstantConsult(request.clientId, doctor.id)
    const now = new Date()
    const sessionEndsAt = new Date(now.getTime() + doctor.instantConsultDurationMinutes * 60 * 1000)

    const claimed = await prisma.instantConsultRequest.updateMany({
      where: {
        id,
        status: InstantConsultStatus.PENDING,
        OR: [
          { doctorId: doctor.id },
          { isBroadcast: true, doctorId: null },
        ],
      },
      data: {
        status: InstantConsultStatus.ACCEPTED,
        doctorId: doctor.id,
        acceptedAt: now,
        chatRoomId,
        sessionEndsAt,
      },
    })

    if (claimed.count === 0) {
      return ok({ error: true, message: 'قبل طبيب آخر هذا الطلب' })
    }

    await notifyClientInstantAccepted(
      request.client.userId,
      id,
      `د. ${doctor.firstName} ${doctor.lastName}`,
    )

    await settleInstantConsultOnAccept(id)

    return ok({ id, chatRoomId, sessionEndsAt: sessionEndsAt.toISOString() })
  } catch (err) {
    console.error('[POST /api/instant-consult/[id]/accept]', err)
    return serverError()
  }
}
