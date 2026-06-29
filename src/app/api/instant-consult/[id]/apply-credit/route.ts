import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { applyCreditToInstantConsult } from '@/lib/payment/client-credit'
import { Role } from '@prisma/client'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth({ roles: [Role.CLIENT] })
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const result = await applyCreditToInstantConsult(id, auth.context.userId)
    if (!result.ok) return ok({ error: true, message: result.message })

    return ok({
      creditUsed: result.creditUsed,
      piRemaining: result.piRemaining,
      fullyPaid: result.fullyPaid,
    })
  } catch (err) {
    console.error('[POST /api/instant-consult/[id]/apply-credit]', err)
    return serverError()
  }
}
