import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import {
  buildInstantConsultEmbedUrl,
  canAccessInstantConsultVideo,
  getInstantConsultVideoRoomName,
} from '@/lib/instant-consult/video'
import { getJitsiServerUrl } from '@/lib/appointments/online-video'
import { getChatPath } from '@/lib/chat/paths'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const consult = await prisma.instantConsultRequest.findUnique({
      where: { id },
      include: {
        client: { select: { userId: true, firstName: true, lastName: true } },
        doctor: { select: { userId: true, firstName: true, lastName: true } },
      },
    })
    if (!consult) return ok({ error: true, message: 'الطلب غير موجود' })

    if (!consult.doctor) {
      return ok({ canJoin: false, reason: 'no_doctor' })
    }

    const isClient =
      auth.context.role === Role.CLIENT &&
      consult.client.userId === auth.context.userId
    const isDoctor =
      auth.context.role === Role.DOCTOR &&
      consult.doctor.userId === auth.context.userId
    if (!isClient && !isDoctor) return ok({ error: true, message: 'غير مصرح' })

    const access = canAccessInstantConsultVideo({
      status: consult.status,
      sessionEndsAt: consult.sessionEndsAt,
    })
    if (!access.allowed) {
      return ok({ canJoin: false, reason: access.reason })
    }

    const displayName = isDoctor
      ? `د. ${consult.doctor.firstName} ${consult.doctor.lastName}`
      : `${consult.client.firstName} ${consult.client.lastName}`

    return ok({
      canJoin: true,
      roomName: getInstantConsultVideoRoomName(consult.id),
      serverUrl: getJitsiServerUrl(),
      displayName,
      embedUrl: buildInstantConsultEmbedUrl(consult.id, displayName),
      sessionEndsAt: consult.sessionEndsAt?.toISOString() ?? null,
      chatRoomId: consult.chatRoomId,
      chatHref: getChatPath(auth.context.role, consult.chatRoomId),
    })
  } catch (err) {
    console.error('[GET /api/instant-consult/[id]/video]', err)
    return serverError()
  }
}
