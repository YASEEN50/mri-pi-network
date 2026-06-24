// src/app/api/admin/verification-v2/route.ts
// قائمة طلبات التحقق مرتبة حسب المخاطرة (HIGH أولاً)

import { NextRequest }    from 'next/server'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role }           from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewVerification)
    if (!auth.success) return fromAppError(auth.error)

    const statusParam = req.nextUrl.searchParams.get('status') ?? 'PENDING_HUMAN'
    /** قائمة المراجعة البشرية: تدمج PENDING_HUMAN الجديدة و ADMIN_REVIEW القديمة */
    const currentStateFilter =
      statusParam === 'PENDING_HUMAN'
        ? { in: ['PENDING_HUMAN', 'ADMIN_REVIEW'] }
        : statusParam

    const page   = Number(req.nextUrl.searchParams.get('page')  ?? 1)
    const limit  = Number(req.nextUrl.searchParams.get('limit') ?? 20)
    const skip   = (page - 1) * limit

    const [sessions, total] = await Promise.all([
      db.verificationSession.findMany({
        where:   { currentState: currentStateFilter, isActive: true },
        orderBy: [
          { score: { finalScore: 'asc' } }, // LOW score = HIGH risk = أولاً
          { updatedAt: 'asc' },
        ],
        skip,
        take: limit,
        include: {
          doctor: {
            select: {
              firstName: true, lastName: true,
              specialization: true, city: true,
              user: { select: { email: true } },
            },
          },
          score: {
            select: { finalScore: true, riskLevel: true, scoreBreakdown: true },
          },
          documents: {
            select: { id: true, docType: true, storageKey: true, isProcessed: true, isFlagged: true },
          },
          fraudChecks: {
            where:  { isFlagged: true, isResolved: false },
            select: { checkType: true, riskFlags: true },
          },
        },
      }),
      db.verificationSession.count({
        where: { currentState: currentStateFilter, isActive: true },
      }),
    ])

    const formatted = sessions.map((s: any) => ({
      sessionId:    s.id,
      doctorId:     s.doctorId,
      doctorName:   `${s.doctor?.firstName ?? ''} ${s.doctor?.lastName ?? ''}`.trim(),
      specialization: s.doctor?.specialization,
      city:         s.doctor?.city,
      email:        s.doctor?.user?.email,
      currentState: s.currentState,
      startedAt:    s.startedAt,
      updatedAt:    s.updatedAt,

      // Score & Risk
      finalScore:   s.score?.finalScore   ? Number(s.score.finalScore)   : null,
      riskLevel:    s.score?.riskLevel    ?? 'HIGH',
      scoreBreakdown: s.score?.scoreBreakdown ?? null,

      // Documents
      documentsCount: s.documents.length,
      hasLicense:     s.documents.some((d: any) => d.docType === 'LICENSE'),
      hasCredentials: s.documents.some((d: any) => d.docType === 'CREDENTIAL'),
      hasSelfie:      s.documents.some((d: any) => d.docType === 'SELFIE'),
      hasIdDoc:       s.documents.some((d: any) => d.docType === 'ID_DOCUMENT'),
      flaggedDocs:    s.documents.filter((d: any) => d.isFlagged).length,

      // Fraud
      fraudFlagsCount: s.fraudChecks.length,
      fraudFlags:      s.fraudChecks.flatMap((f: any) => f.riskFlags),
    }))

    return ok(formatted, { total, page, limit })
  } catch (err) {
    console.error('[GET /api/admin/verification-v2]', err)
    return serverError()
  }
}
