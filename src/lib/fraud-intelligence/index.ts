// src/lib/fraud-intelligence/index.ts
// =============================================================================
// Fraud Intelligence Layer — المُنسِّق الرئيسي
// يُثري RiskEngineInput بإشارات IP + Device + Behavior
// =============================================================================

export { trackIPAttempt, getOrCreateIPReputation, banIP }      from './ip.service'
export { trackDeviceAttempt, getOrCreateDevice, getDeviceUsers } from './device.service'
export { analyzeUploadBehavior, recordBehaviorEvent }           from './behavior.service'
export { getCacheClient, CacheKeys, TTL }                       from './redis'

export type { IPAnalysis }       from './ip.service'
export type { DeviceAnalysis }   from './device.service'
export type { BehaviorAnalysis } from './behavior.service'

import { trackIPAttempt }        from './ip.service'
import { trackDeviceAttempt }    from './device.service'
import { analyzeUploadBehavior,
         recordBehaviorEvent }   from './behavior.service'
import { db }                    from '@/lib/prisma'
import type { RiskTier }         from '@/lib/risk-engine'

// ─── Enriched Fraud Signals ───────────────────────────────────────────────────
// يمتد ليشمل كل ما يحتاجه RiskEngineInput.fraudSignals

export interface EnrichedFraudSignals {
  // الحقول الأصلية (من fraud.service.ts)
  isDuplicateHash:       boolean
  isSimilarImage:        boolean
  // IP Intelligence
  ipRisk:                RiskTier
  isSpamIP:              boolean
  // Device Intelligence
  deviceFingerprintRisk: RiskTier
  isSharedDevice:        boolean
  linkedUsersCount:      number
  // Behavioral
  rapidAttempts:         boolean
  isAutomationSuspected: boolean
  isRapidResubmission:   boolean
  // Raw flags من كل طبقة
  intelligenceFlags:     string[]
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export interface IntelligenceContext {
  userId:    string
  sessionId: string
  ipAddress: string
  deviceId:  string
  userAgent?: string
  /** هل هذه محاولة فاشلة؟ */
  isFailed?: boolean
}

export interface IntelligenceResult {
  signals:        EnrichedFraudSignals
  /** حدث مسجَّل في FraudEvent table */
  eventsCreated:  number
}

/**
 * الدالة الرئيسية — تُستدعى في بداية كل upload/verification request
 * تعمل بشكل async ولا تحجب الـ response
 *
 * @returns EnrichedFraudSignals جاهزة للـ RiskEngineInput
 */
export async function collectIntelligence(
  ctx: IntelligenceContext,
  baseSignals: Pick<EnrichedFraudSignals, 'isDuplicateHash' | 'isSimilarImage'>,
): Promise<IntelligenceResult> {

  // تشغيل الطبقات الثلاث بالتوازي
  const [ipAnalysis, deviceAnalysis, behaviorAnalysis] = await Promise.all([
    trackIPAttempt(ctx.ipAddress, ctx.isFailed).catch(() => null),
    trackDeviceAttempt(ctx.deviceId, ctx.userId).catch(() => null),
    analyzeUploadBehavior(ctx.userId, ctx.sessionId).catch(() => null),
  ])

  // جمع كل الـ flags
  const allFlags = [
    ...(ipAnalysis?.flags      ?? []),
    ...(deviceAnalysis?.flags  ?? []),
    ...(behaviorAnalysis?.flags ?? []),
  ]

  // تسجيل أحداث الاحتيال الخطيرة (background — لا تنتظر)
  let eventsCreated = 0
  const eventPromises: Promise<void>[] = []

  if (deviceAnalysis?.isShared) {
    eventsCreated++
    eventPromises.push(
      db.fraudEvent.create({
        data: {
          type:      'SHARED_DEVICE' as any,
          userId:    ctx.userId,
          sessionId: ctx.sessionId,
          ipAddress: ctx.ipAddress,
          deviceId:  ctx.deviceId,
          severity:  deviceAnalysis.linkedUsersCount > 5 ? 'CRITICAL' : 'HIGH',
          metadata: {
            linkedUsersCount: deviceAnalysis.linkedUsersCount,
            deviceId:         ctx.deviceId,
          },
        },
      }).then(() => {}).catch(() => {})
    )
  }

  if (ipAnalysis?.isSpam) {
    eventsCreated++
    eventPromises.push(
      db.fraudEvent.create({
        data: {
          type:      'IP_FLOOD' as any,
          userId:    ctx.userId,
          sessionId: ctx.sessionId,
          ipAddress: ctx.ipAddress,
          severity:  'HIGH',
          metadata: {
            recentAttempts: ipAnalysis.recentAttempts,
            ipAddress:      ctx.ipAddress,
          },
        },
      }).then(() => {}).catch(() => {})
    )
  }

  if (behaviorAnalysis?.isAutomationSuspected) {
    eventsCreated++
    eventPromises.push(
      recordBehaviorEvent({
        type:      'AUTOMATION_SUSPECTED',
        userId:    ctx.userId,
        sessionId: ctx.sessionId,
        ipAddress: ctx.ipAddress,
        deviceId:  ctx.deviceId,
        metadata: {
          uploadVelocity: behaviorAnalysis.uploadVelocity,
          timingMs:       behaviorAnalysis.timingMs,
        },
      })
    )
  }

  if (behaviorAnalysis?.isRapidResubmission) {
    eventsCreated++
    eventPromises.push(
      recordBehaviorEvent({
        type:      'RAPID_RESUBMISSION',
        userId:    ctx.userId,
        sessionId: ctx.sessionId,
        ipAddress: ctx.ipAddress,
        deviceId:  ctx.deviceId,
      })
    )
  }

  // تحديث session بـ intelligence fields (background)
  eventPromises.push(
    db.verificationSession.updateMany({
      where: { id: ctx.sessionId },
      data: {
        ipAddress: ctx.ipAddress,
        deviceId:  ctx.deviceId,
        userAgent: ctx.userAgent,
      },
    }).then(() => {}).catch(() => {})
  )

  // Fire-and-forget — لا نحجب الـ response
  Promise.allSettled(eventPromises).catch(() => {})

  const signals: EnrichedFraudSignals = {
    // أصلية
    isDuplicateHash:       baseSignals.isDuplicateHash,
    isSimilarImage:        baseSignals.isSimilarImage,
    // IP
    ipRisk:                ipAnalysis?.riskLevel      ?? 'LOW',
    isSpamIP:              ipAnalysis?.isSpam         ?? false,
    // Device
    deviceFingerprintRisk: deviceAnalysis?.riskLevel  ?? 'LOW',
    isSharedDevice:        deviceAnalysis?.isShared   ?? false,
    linkedUsersCount:      deviceAnalysis?.linkedUsersCount ?? 1,
    // Behavior
    rapidAttempts:         behaviorAnalysis?.isAutomationSuspected ?? false,
    isAutomationSuspected: behaviorAnalysis?.isAutomationSuspected ?? false,
    isRapidResubmission:   behaviorAnalysis?.isRapidResubmission   ?? false,
    // All flags
    intelligenceFlags:     allFlags,
  }

  return { signals, eventsCreated }
}

// ─── Cleanup Job ──────────────────────────────────────────────────────────────

/**
 * تنظيف السجلات القديمة — يُستدعى من cron job
 */
export async function cleanupOldIntelligence(daysToKeep = 30): Promise<{
  fraudEvents:   number
  ipReputations: number
}> {
  const cutoff = new Date(Date.now() - daysToKeep * 86_400_000)

  const [fraudEvents, ipReputations] = await Promise.all([
    db.fraudEvent.deleteMany({
      where: { createdAt: { lt: cutoff }, resolved: true },
    }).then((r: { count: number }) => r.count).catch(() => 0),

    db.iPReputation.deleteMany({
      where: { lastSeenAt: { lt: cutoff }, isBanned: false, riskLevel: 'LOW' },
    }).then((r: { count: number }) => r.count).catch(() => 0),
  ])

  return { fraudEvents, ipReputations }
}
