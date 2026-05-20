// src/lib/verification/config.service.ts
// جلب وتحديث إعدادات نظام التحقق من قاعدة البيانات

import { prisma, db } from '@/lib/prisma'

export interface VerificationConfig {
  ai_confidence_threshold:  number   // 75
  face_match_threshold:     number   // 80
  name_match_threshold:     number   // 85
  max_upload_attempts:      number   // 3
  require_human_review:     boolean  // true
}

const DEFAULTS: VerificationConfig = {
  ai_confidence_threshold: 75,
  face_match_threshold:    80,
  name_match_threshold:    85,
  max_upload_attempts:     3,
  require_human_review:    true,
}

export async function getVerificationConfig(): Promise<VerificationConfig> {
  try {
    const configs = await db.systemConfig.findMany({
      where: { key: { in: Object.keys(DEFAULTS) } },
    })

    const map = Object.fromEntries(configs.map((c: { key: string; value: string }) => [c.key, c.value]))

    return {
      ai_confidence_threshold: Number(map.ai_confidence_threshold  ?? DEFAULTS.ai_confidence_threshold),
      face_match_threshold:    Number(map.face_match_threshold     ?? DEFAULTS.face_match_threshold),
      name_match_threshold:    Number(map.name_match_threshold     ?? DEFAULTS.name_match_threshold),
      max_upload_attempts:     Number(map.max_upload_attempts      ?? DEFAULTS.max_upload_attempts),
      require_human_review:    (map.require_human_review ?? 'true') === 'true',
    }
  } catch {
    return DEFAULTS
  }
}

export async function seedDefaultConfig() {
  const entries = Object.entries(DEFAULTS)
  for (const [key, value] of entries) {
    await db.systemConfig.upsert({
      where:  { key },
      update: {},
      create: { key, value: String(value), description: key },
    })
  }
}
