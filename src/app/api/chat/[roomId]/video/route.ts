import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { getChatRoomForUser } from '@/lib/chat/access'
import {
  buildInstantConsultEmbedUrl,
  canAccessInstantConsultVideo,
  getInstantConsultVideoPath,
} from '@/lib/instant-consult/video'
import { getChatPath } from '@/lib/chat/paths'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { roomId } = await params
    const room = await getChatRoomForUser(roomId, auth.context.userId, auth.context.role)
    if (!room) return ok({ error: true, message: 'غير مصرح' })

    const consult = await prisma.instantConsultRequest.findFirst({
      where: { chatRoomId: roomId },
      include: {
        client: { select: { firstName: true, lastName: true } },
        doctor: { select: { firstName: true, lastName: true } },
      },
    })

    if (!consult) {
      return ok({ canJoin: false, reason: 'not_instant_consult' })
    }

    const access = canAccessInstantConsultVideo({
      status: consult.status,
      sessionEndsAt: consult.sessionEndsAt,
    })

    if (!access.allowed) {
      return ok({ canJoin: false, reason: access.reason, consultId: consult.id })
    }

    if (!consult.doctor) {
      return ok({ canJoin: false, reason: 'no_doctor', consultId: consult.id })
    }

    const isDoctor = auth.context.role === 'DOCTOR'
    const displayName = isDoctor
      ? `د. ${consult.doctor.firstName} ${consult.doctor.lastName}`
      : `${consult.client.firstName} ${consult.client.lastName}`

    return ok({
      canJoin: true,
      consultId: consult.id,
      embedUrl: buildInstantConsultEmbedUrl(consult.id, displayName),
      sessionEndsAt: consult.sessionEndsAt?.toISOString() ?? null,
      chatRoomId: roomId,
      chatHref: getChatPath(auth.context.role, roomId),
      videoPath: getInstantConsultVideoPath(consult.id, roomId),
    })
  } catch (err) {
    console.error('[GET /api/chat/[roomId]/video]', err)
    return serverError()
  }
}
