// src/app/api/workers/fraud/route.ts
// Worker: فحص الاحتيال + تشغيل Risk Engine + حفظ النتيجة

import { NextRequest, NextResponse }              from 'next/server'
import { prisma, db }                             from '@/lib/prisma'
import { FraudDetectionService, computePHash }    from '@/lib/verification/fraud.service'
import { evaluateRisk, loadConfigFromDB }         from '@/lib/risk-engine'
import type { RiskEngineInput }                   from '@/lib/risk-engine'
import { collectIntelligence }                    from '@/lib/fraud-intelligence'
import { z }                                      from 'zod'
import { randomUUID }                             from 'crypto'
import { requireEnv }                             from '@/lib/env'
import { readBufferByKey }                        from '@/lib/storage/production-storage'
import {
  ensureLegacyHumanQueue,
  logVerificationPhase,
  VerificationPipelinePhase,
} from '@/lib/verification/lifecycle'
import {
  analyzeDocumentForensics,
  forensicsFlagReason,
} from '@/lib/verification/document-forensics'

export const runtime     = 'nodejs'
export const maxDuration = 60

const JobSchema = z.object({
  jobId:     z.string().uuid(),
  sessionId: z.string().uuid(),
  doctorId:  z.string().uuid(),
})

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = req.headers.get('x-worker-secret')
  if (secret !== requireEnv('WORKER_SECRET')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body   = await req.json().catch(() => null)
  const parsed = JobSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  const { jobId, sessionId, doctorId } = parsed.data

  // ── Idempotency ───────────────────────────────────────────────────────────
  const existing = await db.jobTracking.findUnique({ where: { id: jobId } }).catch(() => null)
  if (existing?.status === 'completed') {
    return NextResponse.json({ success: true, skipped: true })
  }

  await db.jobTracking.update({
    where: { id: jobId },
    data:  { status: 'processing', attempts: { increment: 1 }, updatedAt: new Date() },
  }).catch(() => {})

  try {
    const fraud = new FraudDetectionService()

    // ── 1. جلب الملف الطبي الكامل ─────────────────────────────────────────
    const [doctor, documents] = await Promise.all([
      prisma.doctorProfile.findUnique({
        where:  { id: doctorId },
        select: { firstName: true, lastName: true },
      }),
      db.verificationDocument.findMany({
        where:   { sessionId, isProcessed: true },
        include: { ocrResult: true },
      }),
    ])

    // ── 2. فحص الاحتيال لكل وثيقة ────────────────────────────────────────
    let hasDuplicateHash = false
    let hasSimilarImage  = false
    let maxForensicsScore = 0

    for (const doc of documents) {
      // أ. SHA256 — تطابق دقيق
      if (doc.sha256Hash) {
        const result = await fraud.checkExactDuplicate({
          sha256Hash: doc.sha256Hash,
          doctorId,
          imageType:  doc.docType,
        })
        if (result.isFlagged) {
          hasDuplicateHash = true
          await fraud.saveCheckResult({ sessionId, doctorId, documentId: doc.id, result })
        }
      }

      // ب. pHash + forensics — تشابه بصري وسلامة الملف
      try {
        const buffer = await readBufferByKey(doc.storageKey, doc.storageBucket)
        const pHash        = await computePHash(buffer)

        await db.verificationDocument.update({ where: { id: doc.id }, data: { pHash } })

        const pResult = await fraud.checkVisualDuplicate({ pHash, doctorId, imageType: doc.docType })
        if (pResult.isFlagged) {
          hasSimilarImage = true
          await fraud.saveCheckResult({ sessionId, doctorId, documentId: doc.id, result: pResult })
        }

        await fraud.registerReference({
          doctorId, documentId: doc.id,
          imageType: doc.docType, pHash,
          sha256Hash: doc.sha256Hash ?? '',
        })

        const forensics = await analyzeDocumentForensics(buffer, doc.mimeType, doc.docType)
        maxForensicsScore = Math.max(maxForensicsScore, forensics.score)

        const forensicsUpdate: {
          forensicsScore: number
          forensicsSignals: typeof forensics.signals
          isFlagged?: boolean
          flagReason?: string
        } = {
          forensicsScore:   forensics.score,
          forensicsSignals: forensics.signals,
        }

        if (forensics.score >= 40) {
          const reason = forensicsFlagReason(forensics.signals)
          forensicsUpdate.isFlagged = true
          forensicsUpdate.flagReason = doc.isFlagged && doc.flagReason
            ? `${doc.flagReason} · ${reason}`
            : reason
        }

        await db.verificationDocument.update({
          where: { id: doc.id },
          data:  forensicsUpdate,
        })
      } catch (e) {
        console.error(`[fraud-worker] pHash/forensics failed for doc ${doc.id}:`, e)
      }

      // ج. رقم الترخيص — تكرار
      if (doc.docType === 'LICENSE' && doc.ocrResult?.licenseNumber) {
        const lResult = await fraud.checkLicenseDuplicate({
          licenseNumber: doc.ocrResult.licenseNumber,
          doctorId,
        })
        if (lResult.isFlagged) {
          hasDuplicateHash = true
          await fraud.saveCheckResult({ sessionId, doctorId, documentId: doc.id, result: lResult })
        }
      }
    }

    // ── 3. جمع بيانات الـ Risk Engine ────────────────────────────────────
    const licenseDoc     = documents.find((d: any) => d.docType === 'LICENSE')
    const ocrResult      = licenseDoc?.ocrResult
    const credentialDocs = documents.filter((d: any) => d.docType === 'CREDENTIAL')

    const faceResult = await db.faceVerification.findFirst({
      where:   { sessionId },
      select:  { matchScore: true, confidence: true },
      orderBy: { createdAt: 'desc' },
    }).catch(() => null)

    // ── 3.5. جمع Intelligence signals ────────────────────────────────────────
    const session = await db.verificationSession.findUnique({
      where:  { id: sessionId },
      select: { ipAddress: true, deviceId: true, userId: true },
    }).catch(() => null)

    const intelligence = session?.ipAddress && session?.deviceId
      ? await collectIntelligence(
          {
            userId:    session.userId ?? doctorId,
            sessionId,
            ipAddress: session.ipAddress,
            deviceId:  session.deviceId,
          },
          { isDuplicateHash: hasDuplicateHash, isSimilarImage: hasSimilarImage },
        ).catch(() => null)
      : null

    // ── 4. بناء RiskEngineInput ───────────────────────────────────────────
    const riskInput: RiskEngineInput = {
      doctorProfile: {
        fullName: doctor
          ? `${doctor.firstName} ${doctor.lastName}`.trim()
          : 'غير معروف',
      },
      licenseData: {
        extractedName:  ocrResult?.extractedName    ?? null,
        licenseNumber:  ocrResult?.licenseNumber    ?? null,
        expiryDate:     ocrResult?.expiryDate
          ? (ocrResult.expiryDate as Date).toISOString()
          : null,
        ocrConfidence:  ocrResult?.confidenceScore
          ? Number(ocrResult.confidenceScore)
          : 50,
      },
      faceMatch: {
        similarity:  faceResult?.matchScore ?? 50,
        confidence:  faceResult?.confidence ?? 0.5,
      },
      documents: {
        hasCertificates:  credentialDocs.length > 0,
        certificateCount: credentialDocs.length,
      },
      fraudSignals: {
        isDuplicateHash:        hasDuplicateHash,
        isSimilarImage:         hasSimilarImage,
        ipRisk:                 intelligence?.signals.ipRisk                ?? 'LOW',
        deviceFingerprintRisk:  intelligence?.signals.deviceFingerprintRisk ?? 'LOW',
        isSharedDevice:         intelligence?.signals.isSharedDevice        ?? false,
        rapidAttempts:          intelligence?.signals.rapidAttempts         ?? false,
        isAutomationSuspected:  intelligence?.signals.isAutomationSuspected ?? false,
        isRapidResubmission:    intelligence?.signals.isRapidResubmission   ?? false,
        maxForensicsScore,
      },
    }

    // ── 5. جلب Config من DB وتشغيل Risk Engine ───────────────────────────
    const config     = await loadConfigFromDB()
    const riskResult = evaluateRisk(riskInput, {
      config,
      context: { sessionId, doctorId },
      loggingHook: async (entry) => {
        try {
          const { createHmac } = await import('crypto')
          const auditSecret = requireEnv('AUDIT_LOG_SECRET')
          const id = randomUUID()
          const ts = entry.timestamp
          const hmac = createHmac('sha256', auditSecret)
            .update([id, doctorId, 'RISK_EVALUATION', sessionId, ts].join('|'))
            .digest('hex')

          await db.auditLog.create({
            data: {
              id, actorId: doctorId, actorRole: 'SYSTEM',
              action: 'RISK_EVALUATION',
              targetType: 'verification_session', targetId: sessionId,
              payload: {
                inputHash: entry.inputHash,
                riskScore: entry.output.riskScore,
                riskLevel: entry.output.riskLevel,
                flags:     entry.output.flags,
                durationMs: entry.durationMs,
              },
              hmacSignature: hmac,
            },
          })
        } catch (e) {
          console.error('[fraud-worker] audit log failed:', e)
        }
      },
    })

    console.log(`[fraud-worker] Session ${sessionId}:`, {
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel,
      flags:     riskResult.flags,
    })

    // ── 6. حفظ النتيجة في VerificationScore ──────────────────────────────
    const scoreBreakdownData = {
      riskScore:      riskResult.riskScore,
      rawScore:       riskResult.rawScore,
      flags:          riskResult.flags,
      breakdown:      riskResult.breakdown,
      categories:     riskResult.categories,
      explanation:    riskResult.explanation,
      recommendation: riskResult.recommendation,
      adminPriority:  riskResult.adminPriority,
      configVersion:  riskResult.configVersion,
    }

    await db.verificationScore.upsert({
      where:  { sessionId },
      update: {
        ocrConfidence:   riskInput.licenseData.ocrConfidence,
        faceMatchScore:  riskInput.faceMatch.similarity,
        documentClarity: credentialDocs.length > 0 ? 80 : 40,
        fraudRiskScore:  (hasDuplicateHash ? 70 : 0) + (hasSimilarImage ? 40 : 0) + (maxForensicsScore >= 40 ? 35 : 0),
        finalScore:      riskResult.riskScore,
        riskLevel:       riskResult.riskLevel,
        scoreBreakdown:  scoreBreakdownData,
        algorithmVersion: 'v2',
      },
      create: {
        id: randomUUID(), sessionId, doctorId,
        ocrConfidence:   riskInput.licenseData.ocrConfidence,
        faceMatchScore:  riskInput.faceMatch.similarity,
        documentClarity: credentialDocs.length > 0 ? 80 : 40,
        fraudRiskScore:  (hasDuplicateHash ? 70 : 0) + (hasSimilarImage ? 40 : 0) + (maxForensicsScore >= 40 ? 35 : 0),
        finalScore:      riskResult.riskScore,
        riskLevel:       riskResult.riskLevel,
        scoreBreakdown:  scoreBreakdownData,
        algorithmVersion: 'v2',
      },
    }).catch((e: any) => console.error('[fraud-worker] score save failed:', e))

    // ── 7. تقدم الـ session → PENDING_HUMAN (مراجعة بشرية) + مزامنة القائمة القديمة
    await db.verificationSession.update({
      where: { id: sessionId },
      data:  { currentState: 'PENDING_HUMAN', updatedAt: new Date() },
    })
    await ensureLegacyHumanQueue(doctorId, { notify: true })

    const doctorName = doctor
      ? `${doctor.firstName} ${doctor.lastName}`.trim()
      : 'طبيب'
    const riskReasons: string[] = []
    if (riskResult.riskLevel === 'HIGH') riskReasons.push('مخاطرة عالية')
    if (maxForensicsScore >= 50) riskReasons.push(`forensics ${maxForensicsScore}`)
    if (hasDuplicateHash) riskReasons.push('مستند مكرر')
    if (hasSimilarImage) riskReasons.push('صورة متشابهة')
    if (riskReasons.length > 0) {
      const { notifyAdminsVerificationRiskAlert } = await import('@/lib/notifications/service')
      await notifyAdminsVerificationRiskAlert({
        doctorId,
        sessionId,
        doctorName,
        riskLevel: riskResult.riskLevel,
        riskScore: riskResult.riskScore,
        reasons:   riskReasons,
      }).catch((e) => console.error('[fraud-worker] risk notify failed:', e))
    }

    logVerificationPhase(VerificationPipelinePhase.PENDING_HUMAN, {
      doctorId,
      sessionId,
      source: 'fraud-worker',
      note:   'fraud_complete → legacy_queue',
    })

    // ── 8. إنهاء الـ job ──────────────────────────────────────────────────
    await db.jobTracking.update({
      where: { id: jobId },
      data:  {
        status: 'completed', completedAt: new Date(), updatedAt: new Date(),
        result: { riskScore: riskResult.riskScore, riskLevel: riskResult.riskLevel, flags: riskResult.flags },
      },
    })

    return NextResponse.json({
      success:   true,
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel,
      flags:     riskResult.flags,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown'
    console.error(`[fraud-worker] Job ${jobId} failed:`, msg)
    await db.jobTracking.update({
      where: { id: jobId },
      data:  { status: 'failed', lastError: msg, lastErrorAt: new Date(), updatedAt: new Date() },
    }).catch(() => {})
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
