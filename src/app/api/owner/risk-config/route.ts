// src/app/api/owner/risk-config/route.ts
// إدارة أوزان Risk Engine من لوحة المالك

import { NextRequest }    from 'next/server'
import { requireAuth }    from '@/infrastructure/auth/providers/role-guard'
import { db }             from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role, ActivityType } from '@prisma/client'
import { DEFAULT_CONFIG, loadConfigFromDB, seedRiskEngineConfig } from '@/lib/risk-engine'
import { z }              from 'zod'

// GET — جلب الـ config الحالي مع الـ defaults
export async function GET() {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const current = await loadConfigFromDB()

    return ok({
      current,
      defaults: DEFAULT_CONFIG,
      // مقارنة لإظهار القيم المعدّلة
      overrides: Object.entries(current.weights)
        .filter(([k, v]) => v !== (DEFAULT_CONFIG.weights as any)[k])
        .map(([rule, weight]) => ({
          rule,
          current: weight,
          default: (DEFAULT_CONFIG.weights as any)[rule],
        })),
    })
  } catch (err) {
    console.error('[GET /api/owner/risk-config]', err)
    return serverError()
  }
}

const UpdateSchema = z.object({
  // تحديث وزن قاعدة واحدة
  rule:   z.string().min(1),
  weight: z.number().min(-50).max(100),
})

// POST — تحديث وزن قاعدة واحدة
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const body   = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { rule, weight } = parsed.data
    const key = `risk_engine.weight.${rule}`

    await db.systemConfig.upsert({
      where:  { key },
      update: { value: String(weight) },
      create: {
        key,
        value:       String(weight),
        description: `وزن قاعدة ${rule} في محرك المخاطر`,
      },
    })

    // سجل النشاط
    await db.activityLog.create({
      data: {
        actorId:    auth.context.userId,
        action:     ActivityType.CHANGE_PREMIO_PRICES as any, // نستخدم أقرب action موجود
        targetType: 'RISK_ENGINE_CONFIG',
        targetId:   rule,
        details:    { rule, weight, key },
      },
    })

    return ok({ message: `تم تحديث وزن ${rule} إلى ${weight}` })
  } catch (err) {
    console.error('[POST /api/owner/risk-config]', err)
    return serverError()
  }
}

// PUT — إعادة ضبط كل الأوزان للقيم الافتراضية
export async function PUT() {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    // حذف كل risk_engine configs
    await db.systemConfig.deleteMany({
      where: { key: { startsWith: 'risk_engine.' } },
    })

    // إعادة seed بالقيم الافتراضية
    await seedRiskEngineConfig()

    return ok({ message: 'تم إعادة ضبط جميع أوزان محرك المخاطر للقيم الافتراضية' })
  } catch (err) {
    console.error('[PUT /api/owner/risk-config]', err)
    return serverError()
  }
}

