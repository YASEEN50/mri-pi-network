// GET — تقرير HTML قابل للطباعة / PDF لجلسة تحقق

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { db } from '@/lib/prisma'
import { fromAppError, serverError } from '@/lib/api-response'
import {
  docTypeLabel,
  renderVerificationReportHtml,
  type ReviewReportData,
} from '@/lib/verification/review-report'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewVerification)
    if (!auth.success) return fromAppError(auth.error)

    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId مطلوب' }, { status: 400 })
    }

    const session = await db.verificationSession.findUnique({
      where: { id: sessionId },
      include: {
        doctor: {
          select: {
            firstName: true, lastName: true, specialization: true,
            licenseNumber: true, city: true,
            user: { select: { email: true } },
          },
        },
        documents: {
          select: {
            docType: true, legalName: true, isFlagged: true, flagReason: true,
            forensicsScore: true, forensicsSignals: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        score: {
          select: {
            finalScore: true, riskLevel: true, ocrConfidence: true,
            faceMatchScore: true, fraudRiskScore: true, scoreBreakdown: true,
          },
        },
        faceVerifications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { matchScore: true, confidence: true, facesDetected: true },
        },
        fraudChecks: {
          where: { isFlagged: true },
          select: { checkType: true, similarityScore: true, riskFlags: true },
        },
        assignedTo: { select: { email: true } },
        internalNotes: {
          orderBy: { createdAt: 'asc' },
          select: {
            body: true, createdAt: true,
            author: { select: { email: true } },
          },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 })
    }

    const bd = session.score?.scoreBreakdown as {
      flags?: string[]
      explanation?: string
      recommendation?: string
    } | null

    const report: ReviewReportData = {
      generatedAt: new Date().toLocaleString('ar-SA'),
      sessionId:   session.id,
      currentState: session.currentState,
      doctor: {
        name: `${session.doctor?.firstName ?? ''} ${session.doctor?.lastName ?? ''}`.trim(),
        specialization: session.doctor?.specialization ?? null,
        licenseNumber:  session.doctor?.licenseNumber ?? null,
        city:           session.doctor?.city ?? null,
        email:          session.doctor?.user?.email ?? null,
      },
      score: session.score ? {
        finalScore:     Number(session.score.finalScore),
        riskLevel:      session.score.riskLevel,
        ocrConfidence:  Number(session.score.ocrConfidence),
        faceMatchScore: Number(session.score.faceMatchScore),
        fraudRiskScore: Number(session.score.fraudRiskScore),
        flags:          bd?.flags ?? [],
        explanation:    bd?.explanation ?? null,
        recommendation: bd?.recommendation ?? null,
      } : null,
      faceVerification: session.faceVerifications[0] ? {
        matchScore:     session.faceVerifications[0].matchScore,
        confidence:     session.faceVerifications[0].confidence,
        facesDetected:  session.faceVerifications[0].facesDetected,
      } : null,
      documents: session.documents.map((d: (typeof session.documents)[number]) => {
        const signals = (d.forensicsSignals as Array<{ label: string }> | null) ?? []
        return {
          docType:       d.docType,
          docTypeLabel:  docTypeLabel(d.docType),
          legalName:     d.legalName,
          forensicsScore: d.forensicsScore,
          isFlagged:     d.isFlagged,
          flagReason:    d.flagReason,
          signals:       signals.map((s) => s.label),
        }
      }),
      fraudFlags: session.fraudChecks.map((f: (typeof session.fraudChecks)[number]) => ({
        type:       f.checkType,
        similarity: f.similarityScore,
        flags:      (f.riskFlags as string[]) ?? [],
      })),
      internalNotes: session.internalNotes.map((n: (typeof session.internalNotes)[number]) => ({
        authorName: n.author.email ?? 'مراجع',
        body:       n.body,
        createdAt:  n.createdAt.toLocaleString('ar-SA'),
      })),
      assignment: session.assignedTo ? {
        name:  session.assignedTo.email ?? 'مراجع',
        email: session.assignedTo.email,
      } : null,
    }

    const html = renderVerificationReportHtml(report)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[GET /api/admin/review-v2/report]', err)
    return serverError()
  }
}
