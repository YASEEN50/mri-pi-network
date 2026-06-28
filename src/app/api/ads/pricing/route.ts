import { ok, serverError } from '@/lib/api-response'
import { getAdSettings } from '@/lib/ads/settings'

export async function GET() {
  try {
    const settings = await getAdSettings()
    return ok({
      sidebarWeeklyPricePi: settings.sidebarWeeklyPricePi,
      sidebarMonthlyPricePi: settings.sidebarMonthlyPricePi,
      defaultDurationDays: settings.defaultDurationDays,
      isAcceptingRequests: settings.isAcceptingRequests,
    })
  } catch (err) {
    console.error('[GET /api/ads/pricing]', err)
    return serverError()
  }
}
