// src/lib/verification/lifecycle.ts

// تتبع مراحل التحقق المزدوج + مزامنة قائمة المراجعة البشرية (doctor_verifications / verification_queue)



import { db } from '@/lib/prisma'

import type { QueueStatus, VerificationStage, VerificationStatus } from '@prisma/client'



/** مراحل التحقق في السجلات (وحدة تتبع) */

export const VerificationPipelinePhase = {

  PENDING_AI:    'pending_ai',

  AI_DONE:       'ai_done',

  PENDING_HUMAN: 'pending_human',

  VERIFIED:      'verified',

} as const



/** حالات الجلسة التي تعني «في انتظار المراجع البشري» (v2) */

export const SESSION_HUMAN_REVIEW_STATES = ['PENDING_HUMAN', 'ADMIN_REVIEW'] as const



/** حالات الجلسة بعد اكتمال التحقق الآلي وقبل القرار البشري */

const SESSION_PRE_HUMAN_AI_STATES = [

  'LICENSE_UPLOADED',

  'CREDENTIALS_UPLOADED',

  'FACE_SUBMITTED',

  'FRAUD_CHECK',

  'SCORING',

] as const



export function isHumanReviewSessionState(state: string): boolean {

  return (SESSION_HUMAN_REVIEW_STATES as readonly string[]).includes(state)

}



const PREFIX = '[verification-pipeline]'



export function logVerificationPhase(

  phase: string,

  detail: Record<string, unknown> = {}

): void {

  try {

    console.log(PREFIX, JSON.stringify({ phase, ts: new Date().toISOString(), ...detail }))

  } catch {

    console.log(PREFIX, phase, detail)

  }

}



/** تعيين حالة v2 إلى السجل القديم (doctor_verifications + verification_queue) */

function mapSessionStateToLegacy(sessionState: string): {

  verificationStatus: VerificationStatus

  currentStage:       VerificationStage

  queueStatus:        QueueStatus

} {

  if (sessionState === 'APPROVED') {

    return {

      verificationStatus: 'VERIFIED',

      currentStage:       'FINAL_DECISION',

      queueStatus:        'COMPLETED',

    }

  }

  if (sessionState === 'REJECTED') {

    return {

      verificationStatus: 'REJECTED',

      currentStage:       'FINAL_DECISION',

      queueStatus:        'COMPLETED',

    }

  }

  if (isHumanReviewSessionState(sessionState)) {

    return {

      verificationStatus: 'AI_APPROVED',

      currentStage:       'ADMIN_REVIEW',

      queueStatus:        'WAITING',

    }

  }

  if ((SESSION_PRE_HUMAN_AI_STATES as readonly string[]).includes(sessionState)) {

    return {

      verificationStatus: 'AI_APPROVED',

      currentStage:       'ADMIN_REVIEW',

      queueStatus:        'WAITING',

    }

  }

  if (sessionState === 'PENDING_AI') {

    return {

      verificationStatus: 'PENDING',

      currentStage:       'UPLOAD_CERTIFICATE',

      queueStatus:        'WAITING',

    }

  }

  return {

    verificationStatus: 'PENDING',

    currentStage:       'UPLOAD_CERTIFICATE',

    queueStatus:        'WAITING',

  }

}



/**

 * إنشاء جلسة تحقق v2 بحالة PENDING_AI — يُستدعى فور تسجيل الطبيب.

 */

export async function createPendingAiVerificationSession(

  doctorId: string,

  userId: string,

): Promise<{ sessionId: string; created: boolean }> {

  const existing = await db.verificationSession.findFirst({

    where: { doctorId, isActive: true },

    select: { id: true },

  }).catch(() => null)



  if (existing) {

    return { sessionId: existing.id, created: false }

  }



  const session = await db.verificationSession.create({

    data: {

      doctorId,

      userId,

      currentState: 'PENDING_AI',

      isActive:     true,

    },

  })



  logVerificationPhase(VerificationPipelinePhase.PENDING_AI, {

    doctorId,

    sessionId: session.id,

    userId,

    source:    'createPendingAiVerificationSession',

  })



  return { sessionId: session.id, created: true }

}



/**

 * يضمن وجود سجل في doctor_verifications + verification_queue

 * ويمزامن الحالة مع VerificationSession النشطة (القائمة القديمة للأدمن).

 */

/** @deprecated v1 — doctor_verifications / verification_queue — سيتم إهماله لاحقاً */
export async function ensureLegacyHumanQueue(
  doctorId: string,
  options?: { notify?: boolean },
): Promise<void> {

  const session = await db.verificationSession.findFirst({

    where: { doctorId, isActive: true },

    select: { id: true, currentState: true },

    orderBy: { updatedAt: 'desc' },

  }).catch(() => null)



  const sessionState = session?.currentState ?? 'PENDING_HUMAN'

  const legacy       = mapSessionStateToLegacy(sessionState)



  const dv = await db.doctorVerification.upsert({

    where: { doctorId },

    create: {

      doctorId,

      verificationStatus: legacy.verificationStatus,

      currentStage:       legacy.currentStage,

    },

    update: {

      verificationStatus: legacy.verificationStatus,

      currentStage:       legacy.currentStage,

    },

  })



  await db.verificationQueue.upsert({

    where: { verificationId: dv.id },

    create: {

      verificationId: dv.id,

      priority:       5,

      status:         legacy.queueStatus,

    },

    update: {

      status: legacy.queueStatus,

    },

  })



  logVerificationPhase(VerificationPipelinePhase.PENDING_HUMAN, {

    doctorId,

    sessionId:            session?.id ?? null,

    sessionState,

    doctorVerificationId: dv.id,

    legacyStatus:         legacy.verificationStatus,

    queueStatus:          legacy.queueStatus,

    note:                 'legacy_queue_synced',

  })

  if (options?.notify && (sessionState === 'PENDING_HUMAN' || isHumanReviewSessionState(sessionState))) {
    const { notifyAdminsNewDoctorForReview, notifyDoctorAutomatedVerificationComplete } =
      await import('@/lib/notifications/service')
    await notifyDoctorAutomatedVerificationComplete(doctorId).catch(e =>
      console.error('[lifecycle] doctor notify failed:', e),
    )
    await notifyAdminsNewDoctorForReview(doctorId, session?.id).catch(e =>
      console.error('[lifecycle] admin notify failed:', e),
    )
  }

}



/** بعد موافقة الأدمن على الجلسة (v2) — تحديث السجل القديم */

export async function syncLegacyVerificationOnApproved(doctorId: string): Promise<void> {

  const legacy = mapSessionStateToLegacy('APPROVED')



  const dv = await db.doctorVerification.upsert({

    where: { doctorId },

    create: {

      doctorId,

      verificationStatus: legacy.verificationStatus,

      currentStage:       legacy.currentStage,

    },

    update: {

      verificationStatus: legacy.verificationStatus,

      currentStage:       legacy.currentStage,

    },

  })



  await db.verificationQueue.upsert({

    where: { verificationId: dv.id },

    create: {

      verificationId: dv.id,

      priority:       5,

      status:         legacy.queueStatus,

    },

    update: { status: legacy.queueStatus },

  })



  logVerificationPhase(VerificationPipelinePhase.VERIFIED, {

    doctorId,

    doctorVerificationId: dv.id,

    note:                 'legacy_marked_verified',

  })

}



export async function syncLegacyVerificationOnRejected(doctorId: string): Promise<void> {

  const legacy = mapSessionStateToLegacy('REJECTED')



  const dv = await db.doctorVerification.upsert({

    where: { doctorId },

    create: {

      doctorId,

      verificationStatus: legacy.verificationStatus,

      currentStage:       legacy.currentStage,

    },

    update: {

      verificationStatus: legacy.verificationStatus,

      currentStage:       legacy.currentStage,

    },

  })



  await db.verificationQueue.upsert({

    where: { verificationId: dv.id },

    create: {

      verificationId: dv.id,

      priority:       5,

      status:         legacy.queueStatus,

    },

    update: { status: legacy.queueStatus },

  })



  logVerificationPhase('rejected', {

    doctorId,

    doctorVerificationId: dv.id,

    note:                 'legacy_marked_rejected',

  })

}


