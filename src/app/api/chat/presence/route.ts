import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { clearChatPresence } from '@/lib/chat/presence'

export async function DELETE() {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    await clearChatPresence(auth.context.userId)
    return ok({ cleared: true })
  } catch (err) {
    console.error('[DELETE /api/chat/presence]', err)
    return serverError()
  }
}
