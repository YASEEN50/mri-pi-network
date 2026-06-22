// src/app/api/doctor/verification-status/route.ts
// يُعيد حالة التحقق الكاملة — نظام v2 (VerificationSession)

import { requireAuth }    from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role, ApprovalStatus } from '@prisma/client'
import { computeUploadStage } from '@/lib/verification/document-types'

export async function GET() {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const doctor = await prisma.doctorProfile.findUnique({
      where:  { userId: auth.context.userId },
      select: { id: true, approvalStatus: true },
    })
    if (!doctor) return ok(null)

    // اعتماد الملف الشخصي = موثق (حتى لو جلسة v2 غير نشطة)
    if (doctor.approvalStatus === ApprovalStatus.APPROVED) {
      return ok({
        verificationStatus: 'APPROVED',
        pipelinePhase:      'verified',
        currentStage:       'COMPLETE',
        uploadStage:        'submitted',
        profileApproved:    true,
        message:            'تم اعتماد حسابك',
        documents:          [],
        jobs:               [],
        steps: {
          degreeUploaded: true, licenseUploaded: true, licenseProcessed: true,
          dataflowUploaded: true, identityUploaded: true, selfieUploaded: true,
          credentialsUploaded: true, faceVerified: true, submitted: true,
        },
      })
    }

    if (doctor.approvalStatus === ApprovalStatus.REJECTED) {
      return ok({
        verificationStatus: 'REJECTED',
        pipelinePhase:      'rejected',
        currentStage:       'REJECTED',
        uploadStage:        'submitted',
        profileApproved:    false,
        message:            'تم رفض طلبك',
        documents:          [],
        jobs:               [],
      })
    }

    // ── جلب الـ session النشطة مع كل تفاصيلها ────────────────────────
    const session = await db.verificationSession.findFirst({
      where:   { doctorId: doctor.id, isActive: true },
      include: {
        documents: {
          select: {
            id: true, docType: true, subType: true, legalName: true,
            isProcessed: true, isFlagged: true, flagReason: true, createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true, jobType: true, status: true,
            attempts: true, lastError: true, completedAt: true,
          },
        },
        score: {
          select: {
            finalScore: true, riskLevel: true,
            ocrConfidence: true, faceMatchScore: true,
            documentClarity: true, fraudRiskScore: true,
          },
        },
        faceVerifications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            matchScore: true, confidence: true,
            facesDetected: true, serviceUsed: true,
          },
        },
      },
    }).catch(() => null)

    if (!session) {
      return ok({
        verificationStatus: 'UNVERIFIED',
        pipelinePhase:      'pending_ai',
        currentStage:       'UPLOAD_DEGREE',
        uploadStage:        'degree',
        message:            'لم تبدأ عملية التحقق بعد',
        documents:          [],
        jobs:               [],
      })
    }

    // تصنيف الوثائق
    const docs = session.documents ?? []
    const hasLicense     = docs.some((d: any) => d.docType === 'LICENSE')
    const licenseReady   = docs.some((d: any) => d.docType === 'LICENSE'      && d.isProcessed)
    const hasCredentials = docs.some((d: any) => d.docType === 'CREDENTIAL')
    const hasDataflow    = docs.some((d: any) => d.docType === 'DATAFLOW')
    const hasSelfie      = docs.some((d: any) => d.docType === 'SELFIE')
    const hasIdDoc       = docs.some((d: any) => d.docType === 'ID_DOCUMENT')
    const faceResult     = session.faceVerifications?.[0] ?? null
    const uploadStage    = computeUploadStage(docs, session.currentState)

    return ok({
      sessionId:          session.id,
      verificationStatus: session.currentState,
      pipelinePhase:      mapPipelinePhase(session.currentState, licenseReady),
      currentStage:       mapStateToStage(session.currentState),
      uploadStage,
      licenseExpiryDate:  session.licenseExpiryDate,
      rejectionReason:    session.rejectionReason,
      startedAt:          session.startedAt,
      updatedAt:          session.updatedAt,

      // خطوات الإكمال
      steps: {
        degreeUploaded:      hasCredentials,
        licenseUploaded:     hasLicense,
        licenseProcessed:    licenseReady,
        dataflowUploaded:    hasDataflow,
        identityUploaded:    hasIdDoc,
        selfieUploaded:      hasSelfie,
        credentialsUploaded: hasCredentials,
        faceVerified:        hasSelfie && hasIdDoc,
        submitted:           ['PENDING_HUMAN', 'ADMIN_REVIEW', 'APPROVED', 'REJECTED'].includes(session.currentState),
      },

      // نتيجة مقارنة الوجه
      faceVerification: faceResult ? {
        matchScore:    faceResult.matchScore,
        confidence:    faceResult.confidence,
        facesDetected: faceResult.facesDetected,
        serviceUsed:   faceResult.serviceUsed,
      } : null,

      // درجة المخاطرة
      score: session.score ? {
        finalScore:      Number(session.score.finalScore),
        riskLevel:       session.score.riskLevel,
        ocrConfidence:   Number(session.score.ocrConfidence),
        faceMatchScore:  Number(session.score.faceMatchScore),
        fraudRiskScore:  Number(session.score.fraudRiskScore),
      } : null,

      // وثائق مرفوعة
      documents: docs.map((d: any) => ({
        id:          d.id,
        docType:     d.docType,
        subType:     d.subType,
        legalName:   d.legalName,
        isProcessed: d.isProcessed,
        isFlagged:   d.isFlagged,
        flagReason:  d.flagReason,
      })),

      // آخر jobs
      jobs: (session.jobs ?? []).map((j: any) => ({
        jobType:     j.jobType,
        status:      j.status,
        attempts:    j.attempts,
        lastError:   j.lastError,
        completedAt: j.completedAt,
      })),
    })

  } catch (err) {
    console.error('[GET /api/doctor/verification-status]', err)
    return serverError()
  }
}

/** مراحل التحقق المزدوج للواجهات — تتماشى مع VerificationSession.currentState */
function mapPipelinePhase(state: string, licenseProcessed: boolean): string {
  if (state === 'APPROVED') return 'verified'
  if (state === 'PENDING_HUMAN' || state === 'ADMIN_REVIEW') return 'pending_human'
  if (state === 'LICENSE_UPLOADED') return 'ai_done'
  if (state === 'PENDING_AI') return 'pending_ai'
  // أثناء رفع الرخصة أو معالجة OCR
  if (state === 'UNVERIFIED' && licenseProcessed) return 'ai_done'
  if (
    ['CREDENTIALS_UPLOADED', 'FACE_SUBMITTED', 'FRAUD_CHECK', 'SCORING'].includes(state)
  ) {
    return 'ai_done'
  }
  return 'pending_ai'
}

function mapStateToStage(state: string): string {
  const map: Record<string, string> = {
    PENDING_AI:         'UPLOAD_LICENSE',
    UNVERIFIED:           'UPLOAD_LICENSE',
    LICENSE_UPLOADED:     'UPLOAD_CREDENTIALS',
    CREDENTIALS_UPLOADED: 'FACE_VERIFICATION',
    FACE_SUBMITTED:       'PROCESSING',
    FRAUD_CHECK:          'PROCESSING',
    SCORING:              'PROCESSING',
    PENDING_HUMAN:        'AWAITING_REVIEW',
    ADMIN_REVIEW:         'AWAITING_REVIEW',
    APPROVED:             'COMPLETE',
    REJECTED:             'REJECTED',
    EXPIRED:              'REVERIFY_REQUIRED',
    REVERIFY_REQUIRED:    'UPLOAD_LICENSE',
  }
  return map[state] ?? 'UPLOAD_LICENSE'
}
