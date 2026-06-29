// src/app/api/analytics/doctor/route.ts
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'
import { getActivePremioForUser } from '@/lib/premio/list-doctors'
import { getTierMeta } from '@/lib/premio/tiers'

export async function GET() {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { id: true, piBalance: true },
    })
    if (!doctor) return ok(null)

    const activePremio = await getActivePremioForUser(auth.context.userId)
    const tier = activePremio?.tier ?? 'BASIC'
    const tierMeta = getTierMeta(tier)
    const analyticsLevel = tierMeta.analyticsLevel

    const now       = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const weekStart  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [
      totalAppointments,
      monthAppointments,
      weekAppointments,
      completedTotal,
      cancelledTotal,
      pendingCount,
      totalReviews,
      avgRating,
      totalPublications,
      recentAppointments,
      appointmentsByDay,
      prevMonthAppointments,
      earningsSum,
      referralStats,
    ] = await Promise.all([
      prisma.appointment.count({ where: { doctorId: doctor.id, deletedAt: null } }),
      prisma.appointment.count({ where: { doctorId: doctor.id, deletedAt: null, createdAt: { gte: monthStart } } }),
      prisma.appointment.count({ where: { doctorId: doctor.id, deletedAt: null, createdAt: { gte: weekStart } } }),
      prisma.appointment.count({ where: { doctorId: doctor.id, deletedAt: null, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { doctorId: doctor.id, deletedAt: null, status: 'CANCELLED' } }),
      prisma.appointment.count({ where: { doctorId: doctor.id, deletedAt: null, status: { in: ['PENDING', 'CONFIRMED'] } } }),
      prisma.review.count({ where: { doctorId: doctor.id, deletedAt: null } }),
      prisma.review.aggregate({ _avg: { rating: true }, where: { doctorId: doctor.id, deletedAt: null } }),
      prisma.publication.count({ where: { doctorId: doctor.id, deletedAt: null, status: 'PUBLISHED' } }),
      prisma.appointment.findMany({
        where:   { doctorId: doctor.id, deletedAt: null },
        orderBy: { scheduledAt: 'desc' },
        take:    5,
        include: { client: { select: { id: true, email: true } } },
      }),
      analyticsLevel !== 'basic'
        ? prisma.appointment.groupBy({
            by:      ['status'],
            where:   { doctorId: doctor.id, deletedAt: null },
            _count:  { id: true },
          })
        : Promise.resolve([]),
      prisma.appointment.count({ where: { doctorId: doctor.id, deletedAt: null, createdAt: { gte: prevMonthStart, lt: monthStart } } }),
      analyticsLevel !== 'basic'
        ? prisma.transaction.aggregate({
            where: {
              doctorId: doctor.id,
              status:   'COMPLETED',
              type:     { in: ['APPOINTMENT_FEE', 'DEPOSIT', 'FINAL_PAYMENT'] },
            },
            _sum: { receiverAmount: true, platformFee: true },
          })
        : Promise.resolve({ _sum: { receiverAmount: null, platformFee: null } }),
      analyticsLevel === 'advanced'
        ? Promise.all([
            prisma.referral.count({ where: { fromDoctorId: doctor.id } }),
            prisma.referral.count({ where: { fromDoctorId: doctor.id, status: 'COMPLETED' } }),
            prisma.transaction.aggregate({
              where: { doctorId: doctor.id, type: 'REFERRAL_REWARD', status: 'COMPLETED' },
              _sum: { receiverAmount: true },
            }),
          ])
        : Promise.resolve(null),
    ])

    const completionRate = totalAppointments > 0 ? Math.round((completedTotal / totalAppointments) * 100) : 0
    const monthGrowth    = prevMonthAppointments > 0
      ? Math.round(((monthAppointments - prevMonthAppointments) / prevMonthAppointments) * 100)
      : 0

    const payload: Record<string, unknown> = {
      premioTier: tier,
      analyticsLevel,
      lockedFeatures: analyticsLevel === 'basic'
        ? ['statusBreakdown', 'publications', 'referrals', 'earningsDetail']
        : analyticsLevel === 'full'
          ? ['referrals']
          : [],
      overview: {
        totalAppointments,
        monthAppointments,
        weekAppointments,
        completedTotal,
        cancelledTotal,
        pendingCount,
        completionRate,
        monthGrowth: analyticsLevel !== 'basic' ? monthGrowth : undefined,
      },
      reviews: {
        total:   totalReviews,
        average: Math.round((Number(avgRating._avg.rating) || 0) * 10) / 10,
      },
      recentAppointments: recentAppointments.map(a => ({
        id:          a.id,
        status:      a.status,
        scheduledAt: a.scheduledAt,
        clientName:  a.client?.email ?? 'مريض',
      })),
      earnings: {
        piBalance: Number(doctor.piBalance),
        ...(analyticsLevel !== 'basic'
          ? {
              totalReceived: Number(earningsSum._sum.receiverAmount ?? 0),
              platformFees: Number(earningsSum._sum.platformFee ?? 0),
            }
          : {}),
      },
    }

    if (analyticsLevel !== 'basic') {
      payload.publications = { total: totalPublications }
      payload.appointmentsByStatus = Object.fromEntries(
        appointmentsByDay.map(g => [g.status, g._count.id]),
      )
    }

    if (analyticsLevel === 'advanced' && referralStats) {
      const [sent, completed, rewards] = referralStats
      payload.referrals = {
        sent,
        completed,
        rewardsEarned: Number(rewards._sum.receiverAmount ?? 0),
      }
    }

    return ok(payload)
  } catch (err) {
    console.error('[GET /api/analytics/doctor]', err)
    return serverError()
  }
}
