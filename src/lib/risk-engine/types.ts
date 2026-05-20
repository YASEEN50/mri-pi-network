// src/lib/risk-engine/types.ts
// =============================================================================
// Types مكيّفة مع نظام المشروع — تستخدم نفس أنماط @prisma/client
// =============================================================================

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH'

// ─── Input ────────────────────────────────────────────────────────────────────

export interface RiskEngineInput {
  doctorProfile: {
    fullName: string
  }
  licenseData: {
    extractedName:  string | null
    licenseNumber:  string | null
    expiryDate:     string | null   // ISO date string أو null
    ocrConfidence:  number          // 0–100 (Tesseract confidence)
  }
  faceMatch: {
    similarity:  number   // 0–100
    confidence:  number   // 0–1
  }
  documents: {
    hasCertificates:  boolean
    certificateCount: number
  }
  fraudSignals: {
    isDuplicateHash:       boolean
    isSimilarImage:        boolean
    ipRisk:                RiskTier
    deviceFingerprintRisk: RiskTier
    // Fraud Intelligence Layer (اختياري — يُملأ من collectIntelligence)
    isSharedDevice?:       boolean
    rapidAttempts?:        boolean
    isAutomationSuspected?: boolean
    isRapidResubmission?:  boolean
  }
}

// ─── Rule System ──────────────────────────────────────────────────────────────

export type FlagCode =
  | 'FACE_NO_MATCH'
  | 'FACE_LOW_MATCH'
  | 'FACE_MEDIUM_MATCH'
  | 'LICENSE_EXPIRED'
  | 'LICENSE_EXPIRING_SOON'
  | 'OCR_LOW_CONFIDENCE'
  | 'NAME_MISMATCH'
  | 'DUPLICATE_DOCUMENT'
  | 'SIMILAR_IMAGE'
  | 'HIGH_RISK_IP'
  | 'MEDIUM_RISK_IP'
  | 'HIGH_RISK_DEVICE'
  | 'MEDIUM_RISK_DEVICE'
  | 'NO_CERTIFICATES'
  | 'MULTIPLE_CERTIFICATES'
  // Fraud Intelligence Layer
  | 'SHARED_DEVICE'
  | 'AUTOMATION_SUSPECTED'
  | 'SPAM_IP'
  | 'RAPID_RESUBMISSION'

export type RuleCategory =
  | 'IDENTITY'
  | 'LICENSE'
  | 'FRAUD'
  | 'NETWORK'
  | 'COMPLETENESS'

export interface RuleDefinition {
  id:           FlagCode
  label:        string        // عربي — للعرض في لوحة الأدمن
  category:     RuleCategory
  baseWeight:   number        // يمكن override من config
  isReduction?: boolean       // true = يخفض الـ score
  explanation:  string        // تفسير عربي مفصّل
}

export interface RuleEvaluation {
  rule:        FlagCode
  category:    RuleCategory
  triggered:   boolean
  score:       number         // المساهمة في الـ score (سالب = تخفيض)
  weight:      number
  explanation: string
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  rule:        FlagCode
  score:       number
  category:    RuleCategory
  explanation: string
}

export interface CategorySummary {
  category:       RuleCategory
  totalScore:     number
  triggeredRules: FlagCode[]
}

export interface RiskEngineOutput {
  riskScore:     number          // 0–100 (clamp)
  riskLevel:     RiskTier
  adminPriority: number          // 1=عاجل، 2=متوسط، 3=عادي
  flags:         FlagCode[]
  explanation:   string          // جملة عربية للأدمن
  breakdown:     ScoreBreakdown[]
  categories:    CategorySummary[]
  rawScore:      number          // قبل الـ clamp
  recommendation: string         // توصية للأدمن
  evaluatedAt:   string
  configVersion: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface WeightOverrides {
  [ruleId: string]: number
}

export interface ThresholdConfig {
  faceHighRisk:      number   // default 60
  faceMediumRisk:    number   // default 75
  faceLowRisk:       number   // default 85
  ocrMinConfidence:  number   // default 70 (نفس مقياس Tesseract 0–100)
  nameMinSimilarity: number   // default 80
  licenseWarnDays:   number   // default 30
}

export interface ScoreThresholds {
  low:    number   // ≤ هذا = LOW
  medium: number   // ≤ هذا = MEDIUM، وإلا HIGH
}

export interface RiskEngineConfig {
  version:         string
  weights:         WeightOverrides
  thresholds:      ThresholdConfig
  scoreThresholds: ScoreThresholds
  enableLogging:   boolean
}

// ─── Logging Hook (للتكامل مع ActivityLog / AuditLog) ────────────────────────

export interface RiskEngineLogEntry {
  timestamp:     string
  inputHash:     string
  sessionId?:    string
  doctorId?:     string
  output:        RiskEngineOutput
  durationMs:    number
  configVersion: string
}

export type LoggingHook = (entry: RiskEngineLogEntry) => void | Promise<void>
