// src/app/api/admin/fraud-events/route.ts
// قائمة أحداث الاحتيال للأدمن مع فلترة وإحصائيات

import { NextRequest }   from 'next/server'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { db }            from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role }          from '@prisma/client'

// GET — قائمة FraudEvents
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewAnalytics)
    if (!auth.success) return fromAppError(auth.error)

    const page     = Number(req.nextUrl.searchParams.get('page')     ?? 1)
    const limit    = Number(req.nextUrl.searchParams.get('limit')    ?? 30)
    const type     = req.nextUrl.searchParams.get('type')     ?? undefined
    const severity = req.nextUrl.searchParams.get('severity') ?? undefined
    const resolved = req.nextUrl.searchParams.get('resolved') ?? 'false'
    const skip     = (page - 1) * limit

    const where: any = {
      resolved: resolved === 'true',
      ...(type     && { type }),
      ...(severity && { severity }),
    }

    const [events, total, stats] = await Promise.all([
      db.fraudEvent.findMany({
        where,
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true, type: true, userId: true, sessionId: true,
          ipAddress: true, deviceId: true, severity: true,
          resolved: true, metadata: true, createdAt: true,
        },
      }),
      db.fraudEvent.count({ where }),
      // إحصائيات سريعة
      db.fraudEvent.groupBy({
        by:      ['type'],
        where:   { resolved: false },
        _count:  { _all: true },
        orderBy: { _count: { _all: 'desc' } },
      }).catch(() => []),
    ])

    return ok({
      events,
      stats: stats.map((s: any) => ({
        type:  s.type,
        count: s._count._all,
      })),
    }, { total, page, limit })

  } catch (err) {
    console.error('[GET /api/admin/fraud-events]', err)
    return serverError()
  }
}

// PATCH — تعليم حدث كـ resolved
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewAnalytics)
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await req.json()
    if (!id) return ok({ error: true, message: 'id مطلوب' })

    await db.fraudEvent.update({
      where: { id },
      data: {
        resolved:   true,
        resolvedBy: auth.context.userId,
        resolvedAt: new Date(),
      },
    })

    return ok({ message: 'تم تعليم الحدث كمحلول' })
  } catch (err) {
    console.error('[PATCH /api/admin/fraud-events]', err)
    return serverError()
  }
}
