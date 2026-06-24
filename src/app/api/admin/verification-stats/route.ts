// src/app/api/admin/verification-stats/route.ts
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'

export async function GET() {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewAnalytics)
    if (!auth.success) return fromAppError(auth.error)

    const now      = new Date()
    const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo  = new Date(today.getTime() - 7  * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalVerifications,
      pendingCount,
      verifiedCount,
      rejectedCount,
      todaySubmissions,
      weekSubmissions,
      monthSubmissions,
      queueWaiting,
      specialtyStats,
    ] = await Promise.all([
      db.doctorVerification.count(),
      db.doctorVerification.count({ where: { verificationStatus: 'PENDING' } }),
      db.doctorVerification.count({ where: { verificationStatus: 'VERIFIED' } }),
      db.doctorVerification.count({ where: { verificationStatus: { in: ['REJECTED', 'AI_REJECTED'] } } }),
      db.doctorVerification.count({ where: { createdAt: { gte: today } } }),
      db.doctorVerification.count({ where: { createdAt: { gte: weekAgo } } }),
      db.doctorVerification.count({ where: { createdAt: { gte: monthAgo } } }),
      db.verificationQueue.count({ where: { status: 'WAITING' } }),
      prisma.doctorProfile.groupBy({
        by: ['specialization'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ])

    const acceptanceRate = totalVerifications > 0
      ? Math.round((verifiedCount / totalVerifications) * 100)
      : 0

    // متوسط درجة الثقة
    const avgConfidence = await db.doctorVerification.aggregate({
      _avg: { overallConfidence: true },
      where: { overallConfidence: { not: null } },
    })

    return ok({
      totalVerifications,
      pendingCount,
      verifiedCount,
      rejectedCount,
      acceptanceRate,
      avgConfidence:    Math.round(avgConfidence._avg.overallConfidence ?? 0),
      queueWaiting,
      submissions: {
        today:  todaySubmissions,
        week:   weekSubmissions,
        month:  monthSubmissions,
      },
      specialtyDistribution: specialtyStats.map((s: { specialization: string; _count: { id: number } }) => ({
        specialty: s.specialization,
        count:     s._count.id,
      })),
    })
  } catch (err) {
    console.error('[GET /api/admin/verification-stats]', err)
    return serverError()
  }
}
