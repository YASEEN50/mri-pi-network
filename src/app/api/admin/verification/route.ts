// src/app/api/admin/verification/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const page   = Number(req.nextUrl.searchParams.get('page')  ?? 1)
    const limit  = Number(req.nextUrl.searchParams.get('limit') ?? 20)
    const status = req.nextUrl.searchParams.get('status') ?? 'WAITING'
    const skip   = (page - 1) * limit

    // القائمة القديمة — تُملأ عبر ensureLegacyHumanQueue من مسار v2
    const [queue, total] = await Promise.all([
      db.verificationQueue.findMany({
        where:   { status: status as 'WAITING' | 'IN_REVIEW' | 'COMPLETED' },
        skip,
        take:    limit,
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        include: {
          verification: {
            include: {
              doctor: {
                select: {
                  firstName: true, lastName: true,
                  specialization: true, city: true,
                  user: { select: { email: true } },
                },
              },
              certificates: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                  id: true, aiConfidence: true, nameMatchStatus: true,
                  extractedName: true, extractedSpecialty: true, status: true,
                },
              },
            },
          },
        },
      }),
      db.verificationQueue.count({ where: { status: status as 'WAITING' | 'IN_REVIEW' | 'COMPLETED' } }),
    ])

    console.log('[admin/verification] legacy queue', JSON.stringify({ status, count: queue.length, total }))

    return ok(
      queue.map((q: any) => ({
        queueId:         q.id,
        priority:        q.priority,
        assignedTo:      q.assignedTo,
        queueStatus:     q.status,
        createdAt:       q.createdAt,
        verificationId:  q.verificationId,
        verificationStatus: q.verification.verificationStatus,
        overallConfidence: q.verification.overallConfidence,
        faceMatchConfidence: q.verification.faceMatchConfidence,
        doctorName:      `${q.verification.doctor.firstName} ${q.verification.doctor.lastName}`,
        specialization:  q.verification.doctor.specialization,
        city:            q.verification.doctor.city,
        email:           q.verification.doctor.user.email,
        certificate:     q.verification.certificates[0] ?? null,
      })),
      { total, page, limit }
    )
  } catch (err) {
    console.error('[GET /api/admin/verification]', err)
    return serverError()
  }
}
