// src/app/api/owner/premio-settings/route.ts
import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const Schema = z.object({
  monthlyPrice: z.number().min(0),
  yearlyPrice: z.number().min(0),
  lifetimePrice: z.number().min(0),
  isMonthlyEnabled: z.boolean(),
  isYearlyEnabled: z.boolean(),
  isLifetimeEnabled: z.boolean(),
})

export async function GET() {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)
    const settings = await prisma.premioSettings.findFirst({ orderBy: { createdAt: 'desc' } })
    return ok(settings)
  } catch (err) {
    console.error('[GET /api/owner/premio-settings]', err)
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

    const existing = await prisma.premioSettings.findFirst()
    let settings
    if (existing) {
      settings = await prisma.premioSettings.update({
        where: { id: existing.id },
        data: { ...parsed.data, updatedBy: auth.context.userId },
      })
    } else {
      settings = await prisma.premioSettings.create({
        data: { ...parsed.data, updatedBy: auth.context.userId },
      })
    }

    await prisma.activityLog.create({
      data: {
        actorId: auth.context.userId,
        action: 'CHANGE_PREMIO_PRICES',
        targetType: 'PREMIO_SETTINGS',
        targetId: settings.id,
        details: parsed.data,
      },
    })

    return ok(settings)
  } catch (err) {
    console.error('[POST /api/owner/premio-settings]', err)
    return serverError()
  }
}
