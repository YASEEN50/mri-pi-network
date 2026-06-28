import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { getAdSettings } from '@/lib/ads/settings'

const Schema = z.object({
  sidebarWeeklyPricePi: z.number().min(0),
  sidebarMonthlyPricePi: z.number().min(0),
  defaultDurationDays: z.number().int().min(1).max(365),
  isAcceptingRequests: z.boolean(),
})

export async function GET() {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)
    return ok(await getAdSettings())
  } catch (err) {
    console.error('[GET /api/owner/ad-settings]', err)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const existing = await prisma.adSettings.findFirst()
    const settings = existing
      ? await prisma.adSettings.update({
          where: { id: existing.id },
          data: { ...parsed.data, updatedBy: auth.context.userId },
        })
      : await prisma.adSettings.create({
          data: { ...parsed.data, updatedBy: auth.context.userId },
        })

    return ok({
      sidebarWeeklyPricePi: Number(settings.sidebarWeeklyPricePi),
      sidebarMonthlyPricePi: Number(settings.sidebarMonthlyPricePi),
      defaultDurationDays: settings.defaultDurationDays,
      isAcceptingRequests: settings.isAcceptingRequests,
    })
  } catch (err) {
    console.error('[POST /api/owner/ad-settings]', err)
    return serverError()
  }
}
