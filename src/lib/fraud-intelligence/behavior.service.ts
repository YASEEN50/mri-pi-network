// src/lib/fraud-intelligence/behavior.service.ts
// =============================================================================
// Behavioral Analysis — كشف السلوك الآلي وأنماط إعادة التقديم المشبوهة
// =============================================================================

import { db }                             from '@/lib/prisma'
import { getCacheClient, CacheKeys, TTL } from './redis'
import type { RiskTier }                  from '@/lib/risk-engine'

// ─── Thresholds ───────────────────────────────────────────────────────────────

const THRESHOLDS = {
  MIN_UPLOAD_GAP_SECONDS:  5,    // أقل من 5 ثوانٍ بين uploads = بوت مشبوه
  MIN_SESSION_GAP_SECONDS: 60,   // أقل من دقيقة بين sessions = مريب
  MAX_UPLOADS_TEN_MIN:     8,    // أكثر من 8 uploads في 10 دقائق
  MAX_SESSIONS_ONE_HOUR:   4,    // أكثر من 4 sessions في ساعة
  RAPID_RESUBMIT_HOURS:    1,    // إعادة تقديم بعد رفض خلال ساعة
} as const

// ─── Output ───────────────────────────────────────────────────────────────────

export interface BehaviorAnalysis {
  userId:              string
  riskLevel:           RiskTier
  isAutomationSuspected: boolean
  isRapidResubmission: boolean
  uploadVelocity:      number    // uploads في آخر 10 دقائق
  flags:               string[]
  timingMs?:           number    // وقت منذ آخر upload
}

// ─── Main Service ─────────────────────────────────────────────────────────────

/**
 * تحليل سلوك المستخدم عند كل upload
 */
export async function analyzeUploadBehavior(
  userId:    string,
  sessionId: string,
): Promise<BehaviorAnalysis> {
  const cache = getCacheClient()
  const now   = Date.now()

  // ── 1. Velocity counter (uploads في 10 دقائق) ─────────────────────────────
  const uploadKey     = CacheKeys.userUploads(userId)
  const uploadCount   = await cache.incr(uploadKey)
  if (uploadCount === 1) await cache.expire(uploadKey, TTL.TEN_MIN)

  // ── 2. Timing check (وقت منذ آخر upload) ─────────────────────────────────
  const timingKey     = CacheKeys.sessionTiming(userId)  // نستخدم userId هنا
  const lastTimestamp = await cache.get(timingKey)
  const gapMs         = lastTimestamp ? now - parseInt(lastTimestamp) : null
  const gapSec        = gapMs !== null ? Math.floor(gapMs / 1000) : null

  // حدّث timestamp
  await cache.set(timingKey, String(now), TTL.TEN_MIN)

  // ── 3. تحليل الأنماط ─────────────────────────────────────────────────────
  const flags:      string[] = []
  let   riskLevel:  RiskTier = 'LOW'
  let   isAutomation = false
  let   isRapidResub = false

  // فحص السرعة (bot detection)
  if (gapSec !== null && gapSec < THRESHOLDS.MIN_UPLOAD_GAP_SECONDS) {
    isAutomation = true
    riskLevel    = 'HIGH'
    flags.push('AUTOMATION_SUSPECTED')
    flags.push(`UPLOAD_GAP_${gapSec}s`)
  }

  // فحص الـ velocity
  if (uploadCount > THRESHOLDS.MAX_UPLOADS_TEN_MIN) {
    riskLevel = 'HIGH'
    flags.push('HIGH_UPLOAD_VELOCITY')
    isAutomation = true
  } else if (uploadCount > THRESHOLDS.MAX_UPLOADS_TEN_MIN / 2 && riskLevel === 'LOW') {
    riskLevel = 'MEDIUM'
    flags.push('ELEVATED_UPLOAD_RATE')
  }

  // ── 4. فحص إعادة التقديم السريعة (من DB) ─────────────────────────────────
  isRapidResub = await checkRapidResubmission(userId)
  if (isRapidResub) {
    if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM'
    flags.push('RAPID_RESUBMISSION')
  }

  return {
    userId,
    riskLevel,
    isAutomationSuspected: isAutomation,
    isRapidResubmission:   isRapidResub,
    uploadVelocity:        uploadCount,
    flags,
    timingMs:              gapMs ?? undefined,
  }
}

/**
 * تحقق إذا أعاد المستخدم التقديم بعد رفض خلال RAPID_RESUBMIT_HOURS
 */
async function checkRapidResubmission(userId: string): Promise<boolean> {
  try {
    const recentRejection = await db.verificationSession.findFirst({
      where: {
        userId,
        currentState: 'REJECTED',
        updatedAt: {
          gte: new Date(Date.now() - THRESHOLDS.RAPID_RESUBMIT_HOURS * 3_600_000),
        },
      },
      select: { id: true },
    })
    return !!recentRejection
  } catch {
    return false
  }
}

/**
 * تسجيل حدث سلوكي مشبوه
 */
export async function recordBehaviorEvent(params: {
  userId:    string
  sessionId: string
  type:      'AUTOMATION_SUSPECTED' | 'HIGH_FREQUENCY_ATTEMPT' | 'RAPID_RESUBMISSION'
  ipAddress?: string
  deviceId?:  string
  metadata?:  Record<string, unknown>
}): Promise<void> {
  try {
    await db.fraudEvent.create({
      data: {
        type:      params.type as any,
        userId:    params.userId,
        sessionId: params.sessionId,
        ipAddress: params.ipAddress,
        deviceId:  params.deviceId,
        severity:  'MEDIUM',
        metadata:  params.metadata ?? {},
      },
    })
  } catch {}
}
