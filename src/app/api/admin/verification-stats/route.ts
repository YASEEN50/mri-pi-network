// GET — إحصائيات التحقق v2 للأدmin

import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'

export async function GET() {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewVerification)
    if (!auth.success) return fromAppError(auth.error)

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const humanStates = { in: ['PENDING_HUMAN', 'ADMIN_REVIEW'] as string[] }

    const [
      pendingHuman,
      unassigned,
      highRiskPending,
      suspiciousDocs,
      approvedWeek,
      rejectedWeek,
      avgScoreAgg,
      myAssigned,
    ] = await Promise.all([
      db.verificationSession.count({
        where: { currentState: humanStates, isActive: true },
      }),
      db.verificationSession.count({
        where: { currentState: humanStates, isActive: true, assignedToId: null },
      }),
      db.verificationSession.count({
        where: {
          currentState: humanStates,
          isActive: true,
          score: { riskLevel: 'HIGH' },
        },
      }),
      db.verificationDocument.count({
        where: { forensicsScore: { gte: 40 } },
      }),
      db.verificationSession.count({
        where: { currentState: 'APPROVED', completedAt: { gte: weekAgo } },
      }),
      db.verificationSession.count({
        where: { currentState: 'REJECTED', completedAt: { gte: weekAgo } },
      }),
      db.verificationScore.aggregate({
        where: { session: { currentState: humanStates, isActive: true } },
        _avg: { finalScore: true },
      }),
      db.verificationSession.count({
        where: {
          currentState: humanStates,
          isActive: true,
          assignedToId: auth.context.userId,
        },
      }),
    ])

    return ok({
      pendingHuman,
      unassigned,
      highRiskPending,
      suspiciousDocs,
      approvedWeek,
      rejectedWeek,
      avgPendingScore: avgScoreAgg._avg.finalScore
        ? Math.round(Number(avgScoreAgg._avg.finalScore))
        : null,
      myAssigned,
    })
  } catch (err) {
    console.error('[GET /api/admin/verification-stats]', err)
    return serverError()
  }
}
