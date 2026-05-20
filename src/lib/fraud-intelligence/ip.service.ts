// src/lib/fraud-intelligence/ip.service.ts
// =============================================================================
// IP Intelligence — تتبع السمعة، الـ rate limiting، وكشف الـ flood
// =============================================================================

import { db }                             from '@/lib/prisma'
import { getCacheClient, CacheKeys, TTL } from './redis'
import type { RiskTier }                  from '@/lib/risk-engine'

// ─── Thresholds ───────────────────────────────────────────────────────────────

const THRESHOLDS = {
  ATTEMPTS_MEDIUM:    3,   // محاولات في 10 دقائق → MEDIUM
  ATTEMPTS_HIGH:      6,   // محاولات في 10 دقائق → HIGH
  FAILS_MEDIUM:       2,   // فشل في 10 دقائق → MEDIUM
  FAILS_HIGH:         4,   // فشل في 10 دقائق → HIGH
  TOTAL_MEDIUM:      10,   // مجموع طلبات DB → MEDIUM
  TOTAL_HIGH:        25,   // مجموع طلبات DB → HIGH
} as const

// ─── Output ───────────────────────────────────────────────────────────────────

export interface IPAnalysis {
  ipAddress:      string
  riskLevel:      RiskTier
  recentAttempts: number   // آخر 10 دقائق (Redis)
  recentFails:    number
  totalRequests:  number   // إجمالي (DB)
  isBanned:       boolean
  isSpam:         boolean  // > ATTEMPTS_HIGH في 10 دقائق
  flags:          string[]
}

// ─── Main Service ─────────────────────────────────────────────────────────────

/**
 * جلب أو إنشاء سجل IP مع تحديث العدادات
 * يُستدعى في بداية كل upload endpoint
 */
export async function trackIPAttempt(
  ipAddress: string,
  failed    = false,
): Promise<IPAnalysis> {
  const cache = getCacheClient()

  // ── 1. تحديث Redis counters ───────────────────────────────────────────────
  const attKey  = CacheKeys.ipAttempts(ipAddress)
  const failKey = CacheKeys.ipFails(ipAddress)

  const [attempts, fails] = await Promise.all([
    cache.incr(attKey),
    failed ? cache.incr(failKey) : cache.get(failKey).then(v => parseInt(v ?? '0') || 0),
  ])

  // اضبط TTL فقط عند أول إدخال
  if (attempts === 1) await cache.expire(attKey, TTL.TEN_MIN)
  if (failed && fails === 1) await cache.expire(failKey, TTL.TEN_MIN)

  // ── 2. حساب مستوى المخاطرة ────────────────────────────────────────────────
  const flags: string[] = []
  let riskLevel: RiskTier = 'LOW'

  if (attempts >= THRESHOLDS.ATTEMPTS_HIGH || fails >= THRESHOLDS.FAILS_HIGH) {
    riskLevel = 'HIGH'
    if (attempts >= THRESHOLDS.ATTEMPTS_HIGH) flags.push('HIGH_FREQUENCY_ATTEMPT')
    if (fails >= THRESHOLDS.FAILS_HIGH)       flags.push('HIGH_FAIL_RATE')
  } else if (attempts >= THRESHOLDS.ATTEMPTS_MEDIUM || fails >= THRESHOLDS.FAILS_MEDIUM) {
    riskLevel = 'MEDIUM'
    if (attempts >= THRESHOLDS.ATTEMPTS_MEDIUM) flags.push('ELEVATED_ATTEMPTS')
  }

  const isSpam = attempts >= THRESHOLDS.ATTEMPTS_HIGH

  // ── 3. تحديث DB (upsert) — fire and forget ────────────────────────────────
  const dbRecord = await getOrCreateIPReputation(ipAddress, { riskLevel, failed })

  // تحقق من الـ ban
  if (dbRecord?.isBanned) {
    riskLevel = 'HIGH'
    flags.push('IP_BANNED')
  }

  // ── 4. تصاعد المخاطرة بناءً على DB totals ────────────────────────────────
  if (dbRecord) {
    if (dbRecord.requestCount >= THRESHOLDS.TOTAL_HIGH) {
      riskLevel = 'HIGH'
      flags.push('HIGH_TOTAL_HISTORY')
    } else if (dbRecord.requestCount >= THRESHOLDS.TOTAL_MEDIUM && riskLevel === 'LOW') {
      riskLevel = 'MEDIUM'
    }
  }

  return {
    ipAddress,
    riskLevel,
    recentAttempts: attempts,
    recentFails:    fails,
    totalRequests:  dbRecord?.requestCount ?? attempts,
    isBanned:       dbRecord?.isBanned ?? false,
    isSpam,
    flags,
  }
}

/**
 * Upsert IPReputation في DB — دائماً background
 */
export async function getOrCreateIPReputation(
  ipAddress: string,
  update?: { riskLevel?: RiskTier; failed?: boolean },
): Promise<{
  requestCount: number
  failedAttempts: number
  riskLevel: string
  isBanned: boolean
} | null> {
  try {
    const record = await db.iPReputation.upsert({
      where:  { ipAddress },
      update: {
        requestCount:   { increment: 1 },
        failedAttempts: update?.failed ? { increment: 1 } : undefined,
        lastSeenAt:     new Date(),
        riskLevel:      update?.riskLevel
          ? upgradeRisk(undefined, update.riskLevel)
          : undefined,
      },
      create: {
        ipAddress,
        requestCount:   1,
        failedAttempts: update?.failed ? 1 : 0,
        riskLevel:      update?.riskLevel ?? 'LOW',
        lastSeenAt:     new Date(),
      },
      select: {
        requestCount:   true,
        failedAttempts: true,
        riskLevel:      true,
        isBanned:       true,
      },
    }).catch(() => null)

    return record
  } catch {
    return null
  }
}

/**
 * فرض حظر على IP
 */
export async function banIP(
  ipAddress: string,
  reason:    string,
): Promise<void> {
  await db.iPReputation.upsert({
    where:  { ipAddress },
    update: { isBanned: true, bannedAt: new Date(), banReason: reason, riskLevel: 'HIGH' },
    create: { ipAddress, isBanned: true, bannedAt: new Date(), banReason: reason, riskLevel: 'HIGH' },
  }).catch(() => {})
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function upgradeRisk(
  current:  string | undefined,
  incoming: RiskTier,
): RiskTier {
  const order: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 }
  if (!current) return incoming
  return order[incoming] > order[current] ? incoming : (current as RiskTier)
}
