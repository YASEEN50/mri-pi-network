import { prisma } from '@/lib/prisma'

const DEFAULTS = {
  sidebarWeeklyPricePi: 10,
  sidebarMonthlyPricePi: 25,
  defaultDurationDays: 30,
  isAcceptingRequests: true,
}

export async function getAdSettings() {
  const row = await prisma.adSettings.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!row) return { ...DEFAULTS, id: null as string | null }
  return {
    id: row.id,
    sidebarWeeklyPricePi: Number(row.sidebarWeeklyPricePi),
    sidebarMonthlyPricePi: Number(row.sidebarMonthlyPricePi),
    defaultDurationDays: row.defaultDurationDays,
    isAcceptingRequests: row.isAcceptingRequests,
  }
}

export async function getAdSettingsOrDefaults() {
  return getAdSettings()
}
