// src/lib/risk-engine/config.ts
// =============================================================================
// الأوزان الافتراضية + loader من SystemConfig (Prisma)
// =============================================================================

import type { RiskEngineConfig } from './types'

// ─── الأوزان الافتراضية ───────────────────────────────────────────────────────
// تُستخدم كـ fallback عند عدم وجود قيم في SystemConfig

export const DEFAULT_CONFIG: RiskEngineConfig = {
  version: '2.0.0',

  weights: {
    // Identity
    FACE_NO_MATCH:         70,
    FACE_LOW_MATCH:        35,
    FACE_MEDIUM_MATCH:     15,
    // License
    LICENSE_EXPIRED:       40,
    LICENSE_EXPIRING_SOON: 15,
    OCR_LOW_CONFIDENCE:    20,
    NAME_MISMATCH:         30,
    // Fraud
    DUPLICATE_DOCUMENT:    70,
    SIMILAR_IMAGE:         40,
    // Network
    HIGH_RISK_IP:          30,
    MEDIUM_RISK_IP:        15,
    HIGH_RISK_DEVICE:      25,
    MEDIUM_RISK_DEVICE:    10,
    // Completeness
    NO_CERTIFICATES:       10,
    MULTIPLE_CERTIFICATES: -10,
    // Fraud Intelligence Layer
    SHARED_DEVICE:         40,
    AUTOMATION_SUSPECTED:  35,
    SPAM_IP:               25,
    RAPID_RESUBMISSION:    20,
  },

  thresholds: {
    faceHighRisk:      60,
    faceMediumRisk:    75,
    faceLowRisk:       85,
    ocrMinConfidence:  70,   // Tesseract confidence 0–100
    nameMinSimilarity: 80,
    licenseWarnDays:   30,
  },

  scoreThresholds: {
    low:    30,
    medium: 70,
  },

  enableLogging: true,
}

// ─── Merge helper ─────────────────────────────────────────────────────────────

export function mergeConfig(
  overrides: Partial<RiskEngineConfig> = {}
): RiskEngineConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    weights: {
      ...DEFAULT_CONFIG.weights,
      ...(overrides.weights ?? {}),
    },
    thresholds: {
      ...DEFAULT_CONFIG.thresholds,
      ...(overrides.thresholds ?? {}),
    },
    scoreThresholds: {
      ...DEFAULT_CONFIG.scoreThresholds,
      ...(overrides.scoreThresholds ?? {}),
    },
  }
}

// ─── Loader من SystemConfig (Prisma) ─────────────────────────────────────────
// يُستخدم في fraud-worker لجلب أوزان محدَّثة من DB
// يُخزَّن في Redis لاحقاً لتجنب DB query في كل evaluation

export async function loadConfigFromDB(): Promise<RiskEngineConfig> {
  try {
    // dynamic import لتجنب circular dependencies
    const { db } = await import('@/lib/prisma')

    const configs = await db.systemConfig.findMany({
      where: {
        key: { startsWith: 'risk_engine.' },
      },
    }).catch(() => [])

    if (!configs.length) return DEFAULT_CONFIG

    // تحويل الـ configs إلى override object
    const overrides: Partial<RiskEngineConfig> = {}
    const weightOverrides: Record<string, number> = {}
    const thresholdOverrides: Partial<typeof DEFAULT_CONFIG.thresholds> = {}
    const scoreOverrides: Partial<typeof DEFAULT_CONFIG.scoreThresholds> = {}

    for (const config of configs) {
      const key   = config.key as string
      const value = config.value as string

      // risk_engine.weight.FACE_NO_MATCH = 70
      if (key.startsWith('risk_engine.weight.')) {
        const ruleName = key.replace('risk_engine.weight.', '')
        weightOverrides[ruleName] = Number(value)
      }
      // risk_engine.threshold.faceHighRisk = 60
      else if (key.startsWith('risk_engine.threshold.')) {
        const thName = key.replace('risk_engine.threshold.', '')
        ;(thresholdOverrides as any)[thName] = Number(value)
      }
      // risk_engine.score.low = 30
      else if (key.startsWith('risk_engine.score.')) {
        const sName = key.replace('risk_engine.score.', '')
        ;(scoreOverrides as any)[sName] = Number(value)
      }
      // risk_engine.version
      else if (key === 'risk_engine.version') {
        overrides.version = value
      }
    }

    if (Object.keys(weightOverrides).length)   overrides.weights         = weightOverrides
    if (Object.keys(thresholdOverrides).length) overrides.thresholds     = thresholdOverrides as any
    if (Object.keys(scoreOverrides).length)     overrides.scoreThresholds = scoreOverrides as any

    return mergeConfig(overrides)
  } catch {
    // Fallback للـ defaults عند أي خطأ
    return DEFAULT_CONFIG
  }
}

// ─── Seed default config إلى SystemConfig ────────────────────────────────────
// استدعِ هذا مرة واحدة في migration أو seed

export async function seedRiskEngineConfig(): Promise<void> {
  const { db } = await import('@/lib/prisma')

  const entries: Array<{ key: string; value: string; description: string }> = []

  // Weights
  for (const [rule, weight] of Object.entries(DEFAULT_CONFIG.weights)) {
    entries.push({
      key:         `risk_engine.weight.${rule}`,
      value:       String(weight),
      description: `وزن قاعدة ${rule} في محرك المخاطر`,
    })
  }
  // Thresholds
  for (const [name, value] of Object.entries(DEFAULT_CONFIG.thresholds)) {
    entries.push({
      key:         `risk_engine.threshold.${name}`,
      value:       String(value),
      description: `عتبة ${name} في محرك المخاطر`,
    })
  }
  // Score thresholds
  for (const [name, value] of Object.entries(DEFAULT_CONFIG.scoreThresholds)) {
    entries.push({
      key:         `risk_engine.score.${name}`,
      value:       String(value),
      description: `حد ${name} لتصنيف المخاطرة`,
    })
  }

  for (const entry of entries) {
    await db.systemConfig.upsert({
      where:  { key: entry.key },
      update: {},                  // لا تُحدِّث القيم الموجودة
      create: entry,
    })
  }
}
