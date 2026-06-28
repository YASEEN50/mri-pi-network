import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { closeChatRoom } from '@/lib/chat/close-room'
import { Role } from '@prisma/client'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const auth = await requireAuth({ roles: [Role.CLIENT, Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const { roomId } = await params
    const result = await closeChatRoom(roomId, auth.context.userId, auth.context.role)

    if (!result.ok) return ok({ error: true, message: result.message })

    return ok({ closed: true })
  } catch (err) {
    console.error('[POST /api/chat/[roomId]/close]', err)
    return serverError()
  }
}
