// src/app/api/premio/settings/route.ts
import { ok, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const settings = await prisma.premioSettings.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!settings) return ok({ monthlyPrice: 5, yearlyPrice: 50, lifetimePrice: 150, isMonthlyEnabled: true, isYearlyEnabled: true, isLifetimeEnabled: true })
    return ok({ monthlyPrice: Number(settings.monthlyPrice), yearlyPrice: Number(settings.yearlyPrice), lifetimePrice: Number(settings.lifetimePrice), isMonthlyEnabled: settings.isMonthlyEnabled, isYearlyEnabled: settings.isYearlyEnabled, isLifetimeEnabled: settings.isLifetimeEnabled })
  } catch (err) {
    console.error('[GET /api/premio/settings]', err)
    return serverError()
  }
}
