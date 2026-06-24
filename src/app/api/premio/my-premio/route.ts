// src/app/api/premio/my-premio/route.ts
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { getActivePremioForUser } from '@/lib/premio/list-doctors'
import { getTierMeta } from '@/lib/premio/tiers'

export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const premio = await getActivePremioForUser(auth.context.userId)
    if (!premio) return ok(null)

    const tierMeta = getTierMeta(premio.tier)
    return ok({
      ...premio,
      benefits: {
        badge: tierMeta.badge,
        featuredBoost: tierMeta.featuredBoost,
        analyticsLevel: tierMeta.analyticsLevel,
      },
    })
  } catch (err) {
    console.error('[GET /api/premio/my-premio]', err)
    return serverError()
  }
}
