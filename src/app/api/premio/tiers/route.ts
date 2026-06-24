import { ok, serverError } from '@/lib/api-response'
import { TIER_BENEFITS_ROWS } from '@/lib/premio/tiers'

/** Public Premio tier comparison for subscription page */
export async function GET() {
  try {
    return ok({
      tiers: {
        BASIC: { plans: ['MONTHLY', 'FREE_GIFT'] },
        PRO: { plans: ['YEARLY'] },
        ELITE: { plans: ['LIFETIME'] },
      },
      benefits: TIER_BENEFITS_ROWS,
    })
  } catch (err) {
    console.error('[GET /api/premio/tiers]', err)
    return serverError()
  }
}
