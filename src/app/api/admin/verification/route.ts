// src/app/api/admin/verification/route.ts
// قائمة مراجعة الأطباء — مصدر الحقيقة: VerificationSession (v2)
//
// DEPRECATED (v1): doctor_verifications + verification_queue — تُزامَن للتوافق فقط
// وسيتم إهمالها لاحقاً. لا تُستخدم كمصدر للعرض في هذه الواجهة.

import { NextRequest } from 'next/server'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'

/** تحويل فلتر الواجهة القديمة → حالات VerificationSession */
function resolveSessionFilter(status: string): {
  currentState: { in: string[] } | string
  isActive?: boolean
} {
  switch (status) {
    case 'IN_REVIEW':
      return { currentState: 'ADMIN_REVIEW', isActive: true }
    case 'COMPLETED':
      return { currentState: { in: ['APPROVED', 'REJECTED'] }, isActive: false }
    case 'WAITING':
    default:
      // PENDING_HUMAN فقط — بانتظار المراجعة البشرية
      return { currentState: 'PENDING_HUMAN', isActive: true }
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewVerification)
    if (!auth.success) return fromAppError(auth.error)

    const page   = Number(req.nextUrl.searchParams.get('page')  ?? 1)
    const limit  = Number(req.nextUrl.searchParams.get('limit') ?? 20)
    const status = req.nextUrl.searchParams.get('status') ?? 'WAITING'
    const skip   = (page - 1) * limit

    const sessionFilter = resolveSessionFilter(status)

    const [sessions, total] = await Promise.all([
      db.verificationSession.findMany({
        where: sessionFilter,
        skip,
        take:  limit,
        orderBy: [
          { score: { finalScore: 'asc' } },
          { updatedAt: 'asc' },
        ],
        include: {
          doctor: {
            select: {
              firstName: true,
              lastName: true,
              specialization: true,
              city: true,
              user: { select: { email: true } },
            },
          },
          score: {
            select: {
              finalScore: true,
              ocrConfidence: true,
              faceMatchScore: true,
              riskLevel: true,
            },
          },
          faceVerifications: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { matchScore: true, confidence: true },
          },
        },
      }),
      db.verificationSession.count({ where: sessionFilter }),
    ])

    console.log('[admin/verification] v2 sessions', JSON.stringify({
      status,
      filter: sessionFilter,
      count: sessions.length,
      total,
    }))

    return ok(
      sessions.map((s: any) => {
        const face = s.faceVerifications?.[0]
        const ocrConf = s.score?.ocrConfidence != null
          ? Number(s.score.ocrConfidence)
          : null
        const faceConf = face?.matchScore != null
          ? Number(face.matchScore)
          : s.score?.faceMatchScore != null
            ? Number(s.score.faceMatchScore)
            : null
        const riskScore = s.score?.finalScore != null ? Number(s.score.finalScore) : 50
        const priority = riskScore <= 40 ? 3 : riskScore <= 70 ? 5 : 8

        return {
          queueId:             s.id,
          sessionId:           s.id,
          verificationId:      s.id,
          priority,
          queueStatus:         status,
          createdAt:           s.startedAt,
          verificationStatus:  s.currentState,
          overallConfidence:   ocrConf,
          faceMatchConfidence: faceConf,
          doctorName:          `${s.doctor?.firstName ?? ''} ${s.doctor?.lastName ?? ''}`.trim(),
          specialization:      s.doctor?.specialization,
          city:                s.doctor?.city,
          email:               s.doctor?.user?.email,
          certificate: ocrConf != null
            ? { aiConfidence: ocrConf, nameMatchStatus: 'PENDING' }
            : null,
          riskLevel: s.score?.riskLevel ?? null,
        }
      }),
      { total, page, limit },
    )
  } catch (err) {
    console.error('[GET /api/admin/verification]', err)
    return serverError()
  }
}
