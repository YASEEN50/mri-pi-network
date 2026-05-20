// src/lib/risk-engine/rules.ts
// =============================================================================
// تعريف القواعد — كل قاعدة = كائن واحد في RULE_REGISTRY
// إضافة قاعدة جديدة لا تتطلب تعديل أي ملف آخر
// =============================================================================

import type {
  RiskEngineInput,
  RuleDefinition,
  RuleEvaluation,
  RiskEngineConfig,
  FlagCode,
} from './types'
import { stringSimilarity, isExpired, daysUntilExpiry } from './scoring'

// ─── Evaluator Signature ──────────────────────────────────────────────────────

type RuleEvaluator = (
  input:  RiskEngineInput,
  config: RiskEngineConfig,
) => { triggered: boolean; score: number; detail?: string }

export interface RuleEntry {
  definition: RuleDefinition
  evaluate:   RuleEvaluator
}

// ─── RULE_REGISTRY ────────────────────────────────────────────────────────────

export const RULE_REGISTRY: RuleEntry[] = [

  // ── IDENTITY ────────────────────────────────────────────────────────────────

  {
    definition: {
      id: 'FACE_NO_MATCH', label: 'لا يوجد تطابق للوجه',
      category: 'IDENTITY', baseWeight: 70,
      explanation: 'تطابق الوجه أقل من 60% — خطر عالٍ جداً',
    },
    evaluate: ({ faceMatch }, { thresholds, weights }) => {
      const triggered = faceMatch.similarity < thresholds.faceHighRisk
      return {
        triggered,
        score:  triggered ? (weights['FACE_NO_MATCH'] ?? 70) : 0,
        detail: triggered ? `تطابق=${faceMatch.similarity.toFixed(0)}%` : undefined,
      }
    },
  },

  {
    definition: {
      id: 'FACE_LOW_MATCH', label: 'تطابق الوجه منخفض',
      category: 'IDENTITY', baseWeight: 35,
      explanation: 'تطابق الوجه بين 60%–75% — يحتاج مراجعة',
    },
    evaluate: ({ faceMatch }, { thresholds, weights }) => {
      const triggered =
        faceMatch.similarity >= thresholds.faceHighRisk &&
        faceMatch.similarity <  thresholds.faceMediumRisk
      return {
        triggered,
        score:  triggered ? (weights['FACE_LOW_MATCH'] ?? 35) : 0,
        detail: triggered ? `تطابق=${faceMatch.similarity.toFixed(0)}%` : undefined,
      }
    },
  },

  {
    definition: {
      id: 'FACE_MEDIUM_MATCH', label: 'تطابق الوجه متوسط',
      category: 'IDENTITY', baseWeight: 15,
      explanation: 'تطابق الوجه بين 75%–85% — إشارة تحذيرية خفيفة',
    },
    evaluate: ({ faceMatch }, { thresholds, weights }) => {
      const triggered =
        faceMatch.similarity >= thresholds.faceMediumRisk &&
        faceMatch.similarity <  thresholds.faceLowRisk
      return {
        triggered,
        score:  triggered ? (weights['FACE_MEDIUM_MATCH'] ?? 15) : 0,
        detail: triggered ? `تطابق=${faceMatch.similarity.toFixed(0)}%` : undefined,
      }
    },
  },

  // ── LICENSE ──────────────────────────────────────────────────────────────────

  {
    definition: {
      id: 'LICENSE_EXPIRED', label: 'رخصة المزاولة منتهية',
      category: 'LICENSE', baseWeight: 40,
      explanation: 'تاريخ انتهاء الرخصة تجاوز اليوم',
    },
    evaluate: ({ licenseData }, { weights }) => {
      const triggered = isExpired(licenseData.expiryDate)
      const days = daysUntilExpiry(licenseData.expiryDate)
      return {
        triggered,
        score:  triggered ? (weights['LICENSE_EXPIRED'] ?? 40) : 0,
        detail: triggered && days !== null
          ? `منتهية منذ ${Math.abs(days)} يوم`
          : undefined,
      }
    },
  },

  {
    definition: {
      id: 'LICENSE_EXPIRING_SOON', label: 'الرخصة تنتهي قريباً',
      category: 'LICENSE', baseWeight: 15,
      explanation: 'الرخصة ستنتهي خلال 30 يوماً',
    },
    evaluate: ({ licenseData }, { thresholds, weights }) => {
      if (isExpired(licenseData.expiryDate)) return { triggered: false, score: 0 }
      const days = daysUntilExpiry(licenseData.expiryDate)
      const triggered = days !== null && days >= 0 && days <= thresholds.licenseWarnDays
      return {
        triggered,
        score:  triggered ? (weights['LICENSE_EXPIRING_SOON'] ?? 15) : 0,
        detail: triggered ? `تنتهي خلال ${days} يوم` : undefined,
      }
    },
  },

  {
    definition: {
      id: 'OCR_LOW_CONFIDENCE', label: 'دقة OCR منخفضة',
      category: 'LICENSE', baseWeight: 20,
      explanation: 'لم يتمكن النظام من قراءة الرخصة بوضوح كافٍ',
    },
    evaluate: ({ licenseData }, { thresholds, weights }) => {
      // licenseData.ocrConfidence هنا 0–100 (من Tesseract)
      const triggered = licenseData.ocrConfidence < thresholds.ocrMinConfidence
      return {
        triggered,
        score:  triggered ? (weights['OCR_LOW_CONFIDENCE'] ?? 20) : 0,
        detail: triggered
          ? `دقة=${licenseData.ocrConfidence.toFixed(0)}% (الحد الأدنى: ${thresholds.ocrMinConfidence}%)`
          : undefined,
      }
    },
  },

  {
    definition: {
      id: 'NAME_MISMATCH', label: 'عدم تطابق الاسم',
      category: 'LICENSE', baseWeight: 30,
      explanation: 'الاسم المستخرج من الرخصة لا يطابق اسم الطبيب المسجل',
    },
    evaluate: ({ doctorProfile, licenseData }, { thresholds, weights }) => {
      if (!licenseData.extractedName) return { triggered: false, score: 0 }
      const similarity = stringSimilarity(doctorProfile.fullName, licenseData.extractedName)
      const triggered  = similarity < thresholds.nameMinSimilarity
      return {
        triggered,
        score:  triggered ? (weights['NAME_MISMATCH'] ?? 30) : 0,
        detail: triggered
          ? `تشابه=${similarity}% | مسجّل="${doctorProfile.fullName}" | مستخرج="${licenseData.extractedName}"`
          : undefined,
      }
    },
  },

  // ── FRAUD ────────────────────────────────────────────────────────────────────

  {
    definition: {
      id: 'DUPLICATE_DOCUMENT', label: 'مستند مكرر (SHA256)',
      category: 'FRAUD', baseWeight: 70,
      explanation: 'الصورة مطابقة تماماً لمستند طبيب آخر في قاعدة البيانات',
    },
    evaluate: ({ fraudSignals }, { weights }) => ({
      triggered: fraudSignals.isDuplicateHash,
      score:     fraudSignals.isDuplicateHash ? (weights['DUPLICATE_DOCUMENT'] ?? 70) : 0,
    }),
  },

  {
    definition: {
      id: 'SIMILAR_IMAGE', label: 'صورة متشابهة بصرياً (pHash)',
      category: 'FRAUD', baseWeight: 40,
      explanation: 'الصورة متشابهة بصرياً مع مستند طبيب آخر',
    },
    evaluate: ({ fraudSignals }, { weights }) => ({
      triggered: fraudSignals.isSimilarImage,
      score:     fraudSignals.isSimilarImage ? (weights['SIMILAR_IMAGE'] ?? 40) : 0,
    }),
  },

  // ── NETWORK ──────────────────────────────────────────────────────────────────

  {
    definition: {
      id: 'HIGH_RISK_IP', label: 'IP عالي المخاطرة',
      category: 'NETWORK', baseWeight: 30,
      explanation: 'الطلب قادم من عنوان IP مرتبط بنشاط مشبوه',
    },
    evaluate: ({ fraudSignals }, { weights }) => ({
      triggered: fraudSignals.ipRisk === 'HIGH',
      score:     fraudSignals.ipRisk === 'HIGH' ? (weights['HIGH_RISK_IP'] ?? 30) : 0,
    }),
  },

  {
    definition: {
      id: 'MEDIUM_RISK_IP', label: 'IP متوسط المخاطرة',
      category: 'NETWORK', baseWeight: 15,
      explanation: 'الطلب قادم من عنوان IP مرتبط بنشاط غير معتاد',
    },
    evaluate: ({ fraudSignals }, { weights }) => ({
      triggered: fraudSignals.ipRisk === 'MEDIUM',
      score:     fraudSignals.ipRisk === 'MEDIUM' ? (weights['MEDIUM_RISK_IP'] ?? 15) : 0,
    }),
  },

  {
    definition: {
      id: 'HIGH_RISK_DEVICE', label: 'جهاز عالي المخاطرة',
      category: 'NETWORK', baseWeight: 25,
      explanation: 'بصمة الجهاز مرتبطة بمحاولات احتيال سابقة',
    },
    evaluate: ({ fraudSignals }, { weights }) => ({
      triggered: fraudSignals.deviceFingerprintRisk === 'HIGH',
      score:     fraudSignals.deviceFingerprintRisk === 'HIGH'
        ? (weights['HIGH_RISK_DEVICE'] ?? 25) : 0,
    }),
  },

  {
    definition: {
      id: 'MEDIUM_RISK_DEVICE', label: 'جهاز متوسط المخاطرة',
      category: 'NETWORK', baseWeight: 10,
      explanation: 'بصمة الجهاز مرتبطة بنشاط غير معتاد',
    },
    evaluate: ({ fraudSignals }, { weights }) => ({
      triggered: fraudSignals.deviceFingerprintRisk === 'MEDIUM',
      score:     fraudSignals.deviceFingerprintRisk === 'MEDIUM'
        ? (weights['MEDIUM_RISK_DEVICE'] ?? 10) : 0,
    }),
  },

  // ── COMPLETENESS ─────────────────────────────────────────────────────────────

  {
    definition: {
      id: 'NO_CERTIFICATES', label: 'لا توجد شهادات',
      category: 'COMPLETENESS', baseWeight: 10,
      explanation: 'لم يرفع الطبيب أي شهادات علمية',
    },
    evaluate: ({ documents }, { weights }) => ({
      triggered: !documents.hasCertificates,
      score:     !documents.hasCertificates ? (weights['NO_CERTIFICATES'] ?? 10) : 0,
    }),
  },

  {
    definition: {
      id: 'MULTIPLE_CERTIFICATES', label: 'شهادات متعددة (تخفيض)',
      category: 'COMPLETENESS', baseWeight: -10, isReduction: true,
      explanation: 'رفع الطبيب شهادتين أو أكثر — يُخفّض المخاطرة',
    },
    evaluate: ({ documents }, { weights }) => {
      const triggered = documents.certificateCount >= 2
      return {
        triggered,
        score: triggered ? (weights['MULTIPLE_CERTIFICATES'] ?? -10) : 0,
        detail: triggered ? `${documents.certificateCount} شهادات` : undefined,
      }
    },
  },
  // ── FRAUD INTELLIGENCE ───────────────────────────────────────────────────────

  {
    definition: {
      id: 'SHARED_DEVICE', label: 'جهاز مشترك بين مستخدمين متعددين',
      category: 'FRAUD', baseWeight: 40,
      explanation: 'نفس الجهاز مستخدم من أكثر من 3 حسابات مختلفة',
    },
    evaluate: ({ fraudSignals }, { weights }) => ({
      triggered: fraudSignals.isSharedDevice === true,
      score: fraudSignals.isSharedDevice ? (weights['SHARED_DEVICE'] ?? 40) : 0,
    }),
  },

  {
    definition: {
      id: 'AUTOMATION_SUSPECTED', label: 'سلوك آلي مشبوه',
      category: 'FRAUD', baseWeight: 35,
      explanation: 'أنماط تحميل سريعة تشير إلى استخدام أدوات آلية',
    },
    evaluate: ({ fraudSignals }, { weights }) => ({
      triggered: fraudSignals.isAutomationSuspected === true || fraudSignals.rapidAttempts === true,
      score: (fraudSignals.isAutomationSuspected || fraudSignals.rapidAttempts)
        ? (weights['AUTOMATION_SUSPECTED'] ?? 35) : 0,
    }),
  },

  {
    definition: {
      id: 'SPAM_IP', label: 'IP يُرسل طلبات كثيرة',
      category: 'NETWORK', baseWeight: 25,
      explanation: 'عنوان IP يتجاوز حد الطلبات المسموح به',
    },
    evaluate: ({ fraudSignals }, { weights }) => ({
      triggered: (fraudSignals as any).isSpamIP === true,
      score: (fraudSignals as any).isSpamIP ? (weights['SPAM_IP'] ?? 25) : 0,
    }),
  },

  {
    definition: {
      id: 'RAPID_RESUBMISSION', label: 'إعادة تقديم سريعة بعد رفض',
      category: 'FRAUD', baseWeight: 20,
      explanation: 'أعاد الطبيب التقديم خلال ساعة من آخر رفض',
    },
    evaluate: ({ fraudSignals }, { weights }) => ({
      triggered: fraudSignals.isRapidResubmission === true,
      score: fraudSignals.isRapidResubmission ? (weights['RAPID_RESUBMISSION'] ?? 20) : 0,
    }),
  },

]

// ─── Lookup Map O(1) ──────────────────────────────────────────────────────────

export const RULE_MAP = new Map<FlagCode, RuleEntry>(
  RULE_REGISTRY.map(e => [e.definition.id, e])
)

// ─── Evaluate All ─────────────────────────────────────────────────────────────

export function evaluateAllRules(
  input:  RiskEngineInput,
  config: RiskEngineConfig,
): RuleEvaluation[] {
  return RULE_REGISTRY.map(({ definition, evaluate }) => {
    const result = evaluate(input, config)
    const effectiveWeight = config.weights[definition.id] ?? definition.baseWeight

    return {
      rule:        definition.id,
      category:    definition.category,
      triggered:   result.triggered,
      score:       result.score,
      weight:      effectiveWeight,
      explanation: result.triggered
        ? result.detail
          ? `${definition.explanation} — ${result.detail}`
          : definition.explanation
        : '',
    } satisfies RuleEvaluation
  })
}
