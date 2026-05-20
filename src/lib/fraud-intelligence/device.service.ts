// src/lib/fraud-intelligence/device.service.ts
// =============================================================================
// Device Intelligence — كشف الأجهزة المشتركة والأجهزة عالية الخطورة
// =============================================================================

import { db }                             from '@/lib/prisma'
import { getCacheClient, CacheKeys, TTL } from './redis'
import type { RiskTier }                  from '@/lib/risk-engine'

// ─── Thresholds ───────────────────────────────────────────────────────────────

const THRESHOLDS = {
  SHARED_MEDIUM:     2,   // linkedUsersCount > 2 → MEDIUM
  SHARED_HIGH:       3,   // linkedUsersCount > 3 → HIGH
  ATTEMPTS_MEDIUM:   4,   // محاولات جهاز في 10 دقائق
  ATTEMPTS_HIGH:     8,
} as const

// ─── Output ───────────────────────────────────────────────────────────────────

export interface DeviceAnalysis {
  deviceId:          string
  riskLevel:         RiskTier
  isShared:          boolean       // linkedUsersCount > SHARED_HIGH
  linkedUsersCount:  number
  recentAttempts:    number
  flags:             string[]
}

// ─── Main Service ─────────────────────────────────────────────────────────────

/**
 * تتبع استخدام الجهاز وتحديث السجل
 * يُستدعى مع كل verification request
 */
export async function trackDeviceAttempt(
  deviceId: string,
  userId:   string,
): Promise<DeviceAnalysis> {
  const cache = getCacheClient()

  // ── 1. Redis counter ──────────────────────────────────────────────────────
  const attKey  = CacheKeys.deviceAttempts(deviceId)
  const attempts = await cache.incr(attKey)
  if (attempts === 1) await cache.expire(attKey, TTL.TEN_MIN)

  // ── 2. Upsert DeviceFingerprint + DeviceUser ──────────────────────────────
  const device = await getOrCreateDevice(deviceId, userId)

  // ── 3. حساب مستوى المخاطرة ────────────────────────────────────────────────
  const flags:     string[] = []
  let   riskLevel: RiskTier = 'LOW'

  const linked = device?.linkedUsersCount ?? 1

  if (linked > THRESHOLDS.SHARED_HIGH) {
    riskLevel = 'HIGH'
    flags.push('SHARED_DEVICE')
    flags.push('MULTI_ACCOUNT_DEVICE')
  } else if (linked > THRESHOLDS.SHARED_MEDIUM) {
    riskLevel = 'MEDIUM'
    flags.push('SHARED_DEVICE')
  }

  if (attempts >= THRESHOLDS.ATTEMPTS_HIGH) {
    riskLevel = 'HIGH'
    flags.push('HIGH_FREQUENCY_DEVICE')
  } else if (attempts >= THRESHOLDS.ATTEMPTS_MEDIUM && riskLevel === 'LOW') {
    riskLevel = 'MEDIUM'
    flags.push('ELEVATED_DEVICE_ACTIVITY')
  }

  // ── 4. تحديث riskLevel في DB ─────────────────────────────────────────────
  if (device) {
    const shouldUpgrade =
      (riskLevel === 'HIGH'   && device.riskLevel !== 'HIGH')   ||
      (riskLevel === 'MEDIUM' && device.riskLevel === 'LOW')

    if (shouldUpgrade) {
      await db.deviceFingerprint.update({
        where: { deviceId },
        data:  { riskLevel, lastSeenAt: new Date(), totalAttempts: { increment: 1 } },
      }).catch(() => {})
    } else {
      await db.deviceFingerprint.update({
        where: { deviceId },
        data:  { lastSeenAt: new Date(), totalAttempts: { increment: 1 } },
      }).catch(() => {})
    }
  }

  return {
    deviceId,
    riskLevel,
    isShared:         linked > THRESHOLDS.SHARED_HIGH,
    linkedUsersCount: linked,
    recentAttempts:   attempts,
    flags,
  }
}

/**
 * Upsert DeviceFingerprint + DeviceUser
 * يُعيد العدد المحدَّث للمستخدمين المرتبطين
 */
export async function getOrCreateDevice(
  deviceId: string,
  userId:   string,
  meta?:    Record<string, unknown>,
): Promise<{ linkedUsersCount: number; riskLevel: string } | null> {
  try {
    // 1. Upsert الجهاز
    await db.deviceFingerprint.upsert({
      where:  { deviceId },
      update: { lastSeenAt: new Date() },
      create: {
        deviceId,
        riskLevel: 'LOW',
        linkedUsersCount: 1,
        totalAttempts:    1,
        metadata: meta ?? {},
      },
    })

    // 2. Upsert العلاقة device ↔ user
    const isNew = await db.deviceUser.upsert({
      where:  { deviceId_userId: { deviceId, userId } },
      update: { lastSeenAt: new Date() },
      create: { deviceId, userId },
      select: { id: true },
    }).then(() => false).catch(() => true)

    if (isNew === false) {
      // عدّ المستخدمين الفريدين
      const count = await db.deviceUser.count({ where: { deviceId } })

      // تحديث linkedUsersCount
      const updated = await db.deviceFingerprint.update({
        where: { deviceId },
        data:  { linkedUsersCount: count },
        select: { linkedUsersCount: true, riskLevel: true },
      })

      return updated
    }

    return await db.deviceFingerprint.findUnique({
      where:  { deviceId },
      select: { linkedUsersCount: true, riskLevel: true },
    })
  } catch {
    return null
  }
}

/**
 * جلب كل المستخدمين المرتبطين بجهاز
 */
export async function getDeviceUsers(deviceId: string): Promise<string[]> {
  const rows = await db.deviceUser.findMany({
    where:  { deviceId },
    select: { userId: true },
  }).catch(() => [])
  return rows.map((r: any) => r.userId)
}
