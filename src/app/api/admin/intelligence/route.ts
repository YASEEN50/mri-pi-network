// src/app/api/admin/intelligence/route.ts
// جلب بيانات IP/Device intelligence للأدمن

import { NextRequest }   from 'next/server'
import { requireAuth }   from '@/infrastructure/auth/providers/role-guard'
import { db }            from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role }          from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const view = req.nextUrl.searchParams.get('view') ?? 'overview'

    if (view === 'ips') {
      const ips = await db.iPReputation.findMany({
        where:   { riskLevel: { in: ['HIGH', 'MEDIUM'] } },
        orderBy: [{ riskLevel: 'asc' }, { requestCount: 'desc' }],
        take:    50,
        select: {
          id: true, ipAddress: true, requestCount: true,
          failedAttempts: true, riskLevel: true, isBanned: true,
          banReason: true, lastSeenAt: true,
        },
      })
      return ok(ips)
    }

    if (view === 'devices') {
      const devices = await db.deviceFingerprint.findMany({
        where:   { riskLevel: { in: ['HIGH', 'MEDIUM'] } },
        orderBy: [{ linkedUsersCount: 'desc' }, { totalAttempts: 'desc' }],
        take:    50,
        select: {
          id: true, deviceId: true, riskLevel: true,
          linkedUsersCount: true, totalAttempts: true,
          failedAttempts: true, firstSeenAt: true, lastSeenAt: true,
        },
      })
      return ok(devices)
    }

    // Overview — إحصائيات عامة
    const [totalIPs, bannedIPs, highRiskIPs, totalDevices, sharedDevices,
           openEvents, criticalEvents] = await Promise.all([
      db.iPReputation.count(),
      db.iPReputation.count({ where: { isBanned: true } }),
      db.iPReputation.count({ where: { riskLevel: 'HIGH' } }),
      db.deviceFingerprint.count(),
      db.deviceFingerprint.count({ where: { linkedUsersCount: { gt: 3 } } }),
      db.fraudEvent.count({ where: { resolved: false } }),
      db.fraudEvent.count({ where: { resolved: false, severity: 'CRITICAL' } }),
    ])

    return ok({
      ips:     { total: totalIPs,     banned: bannedIPs,    highRisk: highRiskIPs },
      devices: { total: totalDevices, shared: sharedDevices },
      events:  { open: openEvents,    critical: criticalEvents },
    })

  } catch (err) {
    console.error('[GET /api/admin/intelligence]', err)
    return serverError()
  }
}

// PATCH — حظر IP
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const { action, ipAddress, reason } = await req.json()

    if (action === 'ban_ip' && ipAddress) {
      const { banIP } = await import('@/lib/fraud-intelligence')
      await banIP(ipAddress, reason ?? 'حظر يدوي من الأدمن')
      return ok({ message: `تم حظر IP: ${ipAddress}` })
    }

    return ok({ error: true, message: 'action غير معروف' })
  } catch (err) {
    console.error('[PATCH /api/admin/intelligence]', err)
    return serverError()
  }
}
