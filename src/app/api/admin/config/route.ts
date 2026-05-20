// src/app/api/admin/config/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'
import { z } from 'zod'

export async function GET() {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const configs = await db.systemConfig.findMany({ orderBy: { key: 'asc' } })
    return ok(Object.fromEntries(configs.map((c: { key: string; value: string }) => [c.key, c.value])))
  } catch (err) {
    console.error('[GET /api/admin/config]', err)
    return serverError()
  }
}

const ConfigSchema = z.record(z.string())

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const body   = await req.json()
    const parsed = ConfigSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const updates = Object.entries(parsed.data)
    await Promise.all(updates.map(([key, value]) =>
      db.systemConfig.upsert({
        where:  { key },
        update: { value },
        create: { key, value },
      })
    ))

    return ok({ message: 'تم تحديث الإعدادات بنجاح' })
  } catch (err) {
    console.error('[PUT /api/admin/config]', err)
    return serverError()
  }
}
