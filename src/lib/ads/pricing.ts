import { AdPlan } from '@prisma/client'
import { getAdSettings } from '@/lib/ads/settings'

export function adPlanPrice(settings: Awaited<ReturnType<typeof getAdSettings>>, plan: AdPlan): number {
  return plan === AdPlan.WEEKLY ? settings.sidebarWeeklyPricePi : settings.sidebarMonthlyPricePi
}

export function adPlanDurationDays(settings: Awaited<ReturnType<typeof getAdSettings>>, plan: AdPlan): number {
  return plan === AdPlan.WEEKLY ? 7 : settings.defaultDurationDays
}
