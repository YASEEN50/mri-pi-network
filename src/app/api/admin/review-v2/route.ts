// src/app/api/admin/review-v2/route.ts
// قرار الأدمن النهائي على طلب التحقق — نظام v2 (VerificationSession)

import { NextRequest }  from 'next/server'
import { requireVerificationReviewPermission, requireAdminPermission, ADMIN_PERMISSION_KEYS, hasAdminPermission } from '@/lib/admin/permissions'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role, ApprovalStatus, ActivityType } from '@prisma/client'
import { z } from 'zod'
import { requireEnv } from '@/lib/env'
import {
  ensureLegacyHumanQueue,
  isHumanReviewSessionState,
  syncLegacyVerificationOnApproved,
  syncLegacyVerificationOnRejected,
  logVerificationPhase,
  VerificationPipelinePhase,
} from '@/lib/verification/lifecycle'
import {
  notifyDoctorAndFacilitiesApproved,
  notifyDoctorRejected,
} from '@/lib/notifications/service'

const Schema = z.object({
  sessionId: z.string().uuid(),
  decision:  z.enum(['APPROVE', 'REJECT']),
  notes:     z.string().max(1000).optional(),
})

const AssignSchema = z.object({
  sessionId:    z.string().uuid(),
  assignedToId: z.string().uuid().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const auth = await requireVerificationReviewPermission(parsed.data.decision)
    if (!auth.success) return fromAppError(auth.error)

    const { sessionId, decision, notes } = parsed.data
    const reviewerId = auth.context.userId
    const ip         = req.headers.get('x-forwarded-for') ?? undefined
    const isApprove  = decision === 'APPROVE'

    // جلب الـ session مع بيانات الطبيب
    const session = await db.verificationSession.findUnique({
      where:   { id: sessionId },
      include: {
        doctor: {
          select: {
            id: true, userId: true, firstName: true, lastName: true,
          },
        },
      },
    })
    if (!session) return ok({ error: true, message: 'الجلسة غير موجودة' })
    if (!session.isActive) return ok({ error: true, message: 'هذه الجلسة غير نشطة' })

    // التأكد أن الطلب في مرحلة المراجعة البشرية
    if (!isHumanReviewSessionState(session.currentState)) {
      return ok({
        error:   true,
        message: `الطلب في مرحلة "${session.currentState}" وليس في مرحلة المراجعة`,
      })
    }

    const newState     = isApprove ? 'APPROVED' : 'REJECTED'
    const approvalStatus = isApprove ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED

    // تنفيذ القرار في transaction (مهلة أطول للشبكات البطيئة)
    await prisma.$transaction(
      async (tx) => {
        await tx.verificationSession.update({
          where: { id: sessionId },
          data: {
            currentState:    newState,
            rejectionReason: isApprove ? null : (notes ?? 'رفض من المشرف'),
            rejectedBy:      isApprove ? null : reviewerId,
            rejectedAt:      isApprove ? null : new Date(),
            completedAt:     new Date(),
            isActive:        false,
            updatedAt:       new Date(),
          },
        })

        await tx.doctorProfile.update({
          where: { id: session.doctorId },
          data: {
            approvalStatus,
            approvalNotes: notes ?? null,
            approvedBy:    isApprove ? reviewerId : null,
            approvedAt:    isApprove ? new Date() : null,
          },
        })
      },
      { maxWait: 15_000, timeout: 30_000 },
    )

    // مزامنة القائمة القديمة قبل القرار النهائي ثم تحديث الحالة النهائية
    await ensureLegacyHumanQueue(session.doctorId, { notify: false })
    if (isApprove) {
      await syncLegacyVerificationOnApproved(session.doctorId)
      await notifyDoctorAndFacilitiesApproved(session.doctorId)
      logVerificationPhase(VerificationPipelinePhase.VERIFIED, {
        sessionId,
        doctorId: session.doctorId,
        source:   'admin/review-v2',
      })
    } else {
      await syncLegacyVerificationOnRejected(session.doctorId)
      await notifyDoctorRejected(session.doctorId, notes)
      logVerificationPhase('rejected', {
        sessionId,
        doctorId: session.doctorId,
        source:   'admin/review-v2',
      })
    }

    // 3. سجل النشاط
    await prisma.activityLog.create({
      data: {
        actorId:    reviewerId,
        action:     isApprove ? ActivityType.ADMIN_REVIEW_APPROVE : ActivityType.ADMIN_REVIEW_REJECT,
        targetType: 'VERIFICATION_SESSION',
        targetId:   sessionId,
        details:    { decision, notes, doctorId: session.doctorId },
        ipAddress:  ip,
      },
    })

    // 4. Audit log
    await writeAuditLog({
      actorId:    reviewerId,
      actorRole:  auth.context.role,
      action:     isApprove ? 'ADMIN_APPROVE_DOCTOR' : 'ADMIN_REJECT_DOCTOR',
      targetType: 'verification_session',
      targetId:   sessionId,
      payload:    { decision, notes, doctorId: session.doctorId },
      ip,
    })

    // 5. إشعار للطبيب
    await prisma.notification.create({
      data: {
        userId: session.doctor.userId,
        title:  isApprove ? '🎉 تم التحقق من حسابك بنجاح' : '❌ تم رفض طلب التحقق',
        body:   isApprove
          ? 'تهانينا! تم التحقق من هويتك ومؤهلاتك الطبية. يمكنك الآن استقبال المرضى.'
          : `تم رفض طلب التحقق. ${notes ? 'السبب: ' + notes : ''} يمكنك التواصل مع الدعم لمزيد من المعلومات.`,
        type:   isApprove ? 'DOCTOR_VERIFIED' : 'DOCTOR_REJECTED',
        data:   { sessionId, decision, notes },
      },
    })

    return ok({
      message:  isApprove ? 'تم قبول الطبيب بنجاح ✅' : 'تم رفض الطلب',
      decision,
      sessionId,
    })

  } catch (err) {
    console.error('[POST /api/admin/review-v2]', err)
    return serverError()
  }
}

// ─── GET: جلب تفاصيل session للمراجعة ──────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewVerification)
    if (!auth.success) return fromAppError(auth.error)

    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!sessionId) return ok({ error: true, message: 'sessionId مطلوب' })

    const session = await db.verificationSession.findUnique({
      where:   { id: sessionId },
      include: {
        doctor: {
          select: {
            id: true, firstName: true, lastName: true,
            specialization: true, licenseNumber: true, city: true,
            user: { select: { email: true, createdAt: true } },
          },
        },
        documents: {
          select: {
            id: true, docType: true, subType: true, legalName: true,
            storageKey: true, isProcessed: true, isFlagged: true, flagReason: true,
            mimeType: true, fileSizeBytes: true, createdAt: true,
            forensicsScore: true, forensicsSignals: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        score: {
          select: {
            finalScore: true, riskLevel: true,
            ocrConfidence: true, faceMatchScore: true,
            documentClarity: true, fraudRiskScore: true,
            scoreBreakdown: true, algorithmVersion: true,
          },
        },
        faceVerifications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            matchScore: true, confidence: true,
            facesDetected: true, serviceUsed: true, createdAt: true,
          },
        },
        fraudChecks: {
          where:  { isFlagged: true },
          select: {
            checkType: true, isFlagged: true,
            similarityScore: true, riskFlags: true,
            matchedDoctorId: true, isResolved: true,
          },
        },
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            jobType: true, status: true, attempts: true,
            lastError: true, result: true, completedAt: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            adminProfile: { select: { role: true } },
          },
        },
        _count: { select: { internalNotes: true } },
      },
    })

    if (!session) return ok({ error: true, message: 'الجلسة غير موجودة' })

    // استلام تلقائي عند فتح الطلب (إذا غير مُسنَد)
    let assignee = session.assignedTo
    let assignedAt = session.assignedAt
    if (isHumanReviewSessionState(session.currentState) && !session.assignedToId) {
      const now = new Date()
      await db.verificationSession.update({
        where: { id: sessionId },
        data:  {
          assignedToId: auth.context.userId,
          assignedById: auth.context.userId,
          assignedAt:   now,
        },
      })
      assignedAt = now
      assignee = await db.user.findUnique({
        where:  { id: auth.context.userId },
        select: {
          id: true,
          email: true,
          adminProfile: { select: { role: true } },
        },
      })
      await prisma.activityLog.create({
        data: {
          actorId:    auth.context.userId,
          action:     ActivityType.VERIFICATION_ASSIGNED,
          targetType: 'VERIFICATION_SESSION',
          targetId:   sessionId,
          details:    { assignedToId: auth.context.userId, mode: 'self_claim' },
        },
      }).catch(() => {})
    }

    return ok({
      sessionId:      session.id,
      currentState:   session.currentState,
      startedAt:      session.startedAt,
      updatedAt:      session.updatedAt,
      rejectionReason: session.rejectionReason,

      assignment: assignee ? {
        id:        assignee.id,
        name:      assignee.email ?? 'مراجع',
        email:     assignee.email,
        assignedAt,
      } : null,
      internalNotesCount: session._count.internalNotes,

      doctor: {
        id:             session.doctor?.id,
        name:           `${session.doctor?.firstName ?? ''} ${session.doctor?.lastName ?? ''}`.trim(),
        specialization: session.doctor?.specialization,
        licenseNumber:  session.doctor?.licenseNumber,
        city:           session.doctor?.city,
        email:          session.doctor?.user?.email,
        memberSince:    session.doctor?.user?.createdAt,
      },

      score: session.score ? (() => {
        const bd = session.score.scoreBreakdown as any
        return {
          // الأرقام الأساسية
          finalScore:     Number(session.score.finalScore),
          riskLevel:      session.score.riskLevel,
          ocrConfidence:  Number(session.score.ocrConfidence),
          faceMatchScore: Number(session.score.faceMatchScore),
          fraudRiskScore: Number(session.score.fraudRiskScore),
          algorithmVersion: session.score.algorithmVersion,
          // Risk Engine v2 — موجود فقط عند algorithmVersion = 'v2'
          rawScore:       bd?.rawScore      ?? null,
          flags:          bd?.flags         ?? [],
          breakdown:      bd?.breakdown     ?? [],
          categories:     bd?.categories    ?? [],
          explanation:    bd?.explanation   ?? null,
          recommendation: bd?.recommendation ?? null,
          adminPriority:  bd?.adminPriority  ?? null,
          configVersion:  bd?.configVersion  ?? null,
        }
      })() : null,

      faceVerification: session.faceVerifications?.[0] ?? null,

      documents: session.documents.map((d: any) => ({
        id:          d.id,
        docType:     d.docType,
        subType:     d.subType,
        legalName:   d.legalName,
        storageKey:  d.storageKey,
        url:         `/api/files/${d.storageKey.split('/').map(encodeURIComponent).join('/')}`,
        isProcessed: d.isProcessed,
        isFlagged:   d.isFlagged,
        flagReason:  d.flagReason,
        forensicsScore:  d.forensicsScore,
        forensicsSignals: d.forensicsSignals,
        mimeType:    d.mimeType,
        sizeKb:      Math.round(d.fileSizeBytes / 1024),
        createdAt:   d.createdAt,
      })),

      fraudFlags: session.fraudChecks.map((f: any) => ({
        type:            f.checkType,
        similarity:      f.similarityScore,
        flags:           f.riskFlags,
        matchedDoctorId: f.matchedDoctorId,
        resolved:        f.isResolved,
      })),

      jobs: session.jobs.map((j: any) => ({
        type:        j.jobType,
        status:      j.status,
        attempts:    j.attempts,
        error:       j.lastError,
        result:      j.result,
        completedAt: j.completedAt,
      })),
    })

  } catch (err) {
    console.error('[GET /api/admin/review-v2]', err)
    return serverError()
  }
}

// ─── PATCH: إسناد/إعادة إسناد المراجع ───────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewVerification)
    if (!auth.success) return fromAppError(auth.error)

    const parsed = AssignSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { sessionId, assignedToId } = parsed.data

    const session = await db.verificationSession.findUnique({
      where:  { id: sessionId },
      select: { id: true, currentState: true, assignedToId: true },
    })
    if (!session) return ok({ error: true, message: 'الجلسة غير موجودة' })
    if (!isHumanReviewSessionState(session.currentState)) {
      return ok({ error: true, message: 'لا يمكن إسناد طلب ليس في مرحلة المراجعة البشرية' })
    }

    const isOwner = auth.context.role === Role.OWNER
    const canAssignOthers = isOwner || await hasAdminPermission(
      auth.context.userId,
      auth.context.role,
      ADMIN_PERMISSION_KEYS.canAssignTasks,
    )

    if (assignedToId === null) {
      if (!isOwner && session.assignedToId !== auth.context.userId) {
        return ok({ error: true, message: 'لا يمكنك تحرير إسناد مراجع آخر' })
      }
    } else if (assignedToId === auth.context.userId) {
      // استلام يدوي — مسموح لأي مراجع
    } else if (!canAssignOthers) {
      return ok({ error: true, message: 'لا تملك صلاحية إسناد طلب لمراجع آخر' })
    }

    if (assignedToId) {
      const reviewer = await db.user.findFirst({
        where: { id: assignedToId, role: { in: [Role.ADMIN, Role.OWNER] }, isActive: true },
        select: { id: true, email: true },
      })
      if (!reviewer) return ok({ error: true, message: 'المراجع غير موجود' })
    }

    await db.verificationSession.update({
      where: { id: sessionId },
      data:  {
        assignedToId,
        assignedById: auth.context.userId,
        assignedAt:   assignedToId ? new Date() : null,
      },
    })

    await prisma.activityLog.create({
      data: {
        actorId:    auth.context.userId,
        action:     ActivityType.VERIFICATION_ASSIGNED,
        targetType: 'VERIFICATION_SESSION',
        targetId:   sessionId,
        details:    { assignedToId, mode: 'manual' },
      },
    }).catch(() => {})

    return ok({
      message:      assignedToId ? 'تم إسناد الطلب' : 'تم تحرير الإسناد',
      assignedToId,
    })
  } catch (err) {
    console.error('[PATCH /api/admin/review-v2]', err)
    return serverError()
  }
}

async function writeAuditLog(params: {
  actorId: string; actorRole: string; action: string
  targetType: string; targetId: string
  payload: Record<string, unknown>; ip?: string
}) {
  try {
    const { createHmac, randomUUID } = await import('crypto')
    const secret    = requireEnv('AUDIT_LOG_SECRET')
    const timestamp = new Date()
    const id        = randomUUID()
    const hmac      = createHmac('sha256', secret)
      .update([id, params.actorId, params.action, params.targetId, timestamp.toISOString()].join('|'))
      .digest('hex')

    await db.auditLog.create({
      data: {
        id,
        actorId:       params.actorId,
        actorRole:     params.actorRole,
        action:        params.action,
        targetType:    params.targetType,
        targetId:      params.targetId,
        payload:       params.payload,
        ipAddress:     params.ip,
        hmacSignature: hmac,
        createdAt:     timestamp,
      },
    })
  } catch {}
}
