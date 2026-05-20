// src/lib/risk-engine/riskEngine.ts
// =============================================================================
// المحرك الرئيسي — يستبدل ScoreEngine القديم ويتوافق مع fraud-worker
// =============================================================================

import type {
  RiskEngineInput,
  RiskEngineOutput,
  RiskEngineConfig,
  ScoreBreakdown,
  CategorySummary,
  FlagCode,
  RuleCategory,
  LoggingHook,
  RuleEvaluation,
} from './types'
import { evaluateAllRules }                         from './rules'
import { clamp, scoreToTier, tierToPriority,
         tierToRecommendation, hashInput }          from './scoring'
import { DEFAULT_CONFIG, mergeConfig }              from './config'

// ─── Arabic Category Labels ───────────────────────────────────────────────────

const CATEGORY_AR: Record<RuleCategory, string> = {
  IDENTITY:     'هوية الطبيب',
  LICENSE:      'رخصة المزاولة',
  FRAUD:        'كشف الاحتيال',
  NETWORK:      'الشبكة والجهاز',
  COMPLETENESS: 'اكتمال الملف',
}

// ─── Explanation Builder ──────────────────────────────────────────────────────

function buildExplanation(
  triggered: RuleEvaluation[],
  riskScore: number,
  riskLevel: RiskEngineOutput['riskLevel'],
): string {
  const levelLabel = {
    HIGH:   'مخاطرة عالية',
    MEDIUM: 'مخاطرة متوسطة',
    LOW:    'مخاطرة منخفضة',
  }[riskLevel]

  if (!triggered.length) {
    return `${levelLabel} (${riskScore}/100) — لم يتم رصد أي إشارات مخاطرة`
  }

  const byCategory = triggered.reduce<Record<string, string[]>>((acc, r) => {
    const cat = CATEGORY_AR[r.category]
    ;(acc[cat] = acc[cat] ?? []).push(r.explanation)
    return acc
  }, {})

  const parts = Object.entries(byCategory)
    .map(([cat, items]) => `[${cat}] ${items.join(' | ')}`)
    .join(' ‖ ')

  return `${levelLabel} (${riskScore}/100) — ${parts}`
}

// ─── Category Aggregation ─────────────────────────────────────────────────────

function aggregateCategories(evals: RuleEvaluation[]): CategorySummary[] {
  const map = new Map<RuleCategory, CategorySummary>()

  for (const ev of evals) {
    if (!map.has(ev.category)) {
      map.set(ev.category, { category: ev.category, totalScore: 0, triggeredRules: [] })
    }
    const cat = map.get(ev.category)!
    cat.totalScore += ev.score
    if (ev.triggered) cat.triggeredRules.push(ev.rule)
  }

  return Array.from(map.values())
}

// ─── Core evaluateRisk ────────────────────────────────────────────────────────

export interface EvaluateRiskOptions {
  config?:       Partial<RiskEngineConfig>
  loggingHook?:  LoggingHook
  /** sessionId و doctorId للـ logging hook */
  context?: {
    sessionId?: string
    doctorId?:  string
  }
}

/**
 * الدالة الرئيسية — تستبدل ScoreEngine.calculate()
 * دالة نقية بدون side effects خارج الـ loggingHook
 */
export function evaluateRisk(
  input:   RiskEngineInput,
  options: EvaluateRiskOptions = {},
): RiskEngineOutput {
  const startTime = Date.now()
  const config    = mergeConfig(options.config)

  // 1. تقييم كل القواعد
  const evaluations = evaluateAllRules(input, config)

  // 2. حساب الـ raw score
  const rawScore = evaluations.reduce((sum, ev) => sum + ev.score, 0)

  // 3. Clamp إلى [0, 100]
  const riskScore = clamp(rawScore)

  // 4. مستوى المخاطرة
  const riskLevel = scoreToTier(riskScore, config.scoreThresholds)

  // 5. القواعد المُفعَّلة فقط
  const triggeredEvals = evaluations.filter(ev => ev.triggered)

  // 6. Flags
  const flags = triggeredEvals.map(ev => ev.rule) as FlagCode[]

  // 7. Breakdown
  const breakdown: ScoreBreakdown[] = triggeredEvals.map(ev => ({
    rule:        ev.rule,
    score:       ev.score,
    category:    ev.category,
    explanation: ev.explanation,
  }))

  // 8. Categories
  const categories = aggregateCategories(evaluations)

  // 9. Explanation
  const explanation = buildExplanation(triggeredEvals, riskScore, riskLevel)

  const output: RiskEngineOutput = {
    riskScore,
    riskLevel,
    adminPriority:  tierToPriority(riskLevel),
    flags,
    explanation,
    breakdown,
    categories,
    rawScore,
    recommendation: tierToRecommendation(riskLevel),
    evaluatedAt:    new Date().toISOString(),
    configVersion:  config.version,
  }

  // 10. Logging hook — fire-and-forget لا يبطئ الاستجابة
  if (config.enableLogging && options.loggingHook) {
    Promise.resolve(
      options.loggingHook({
        timestamp:     output.evaluatedAt,
        inputHash:     hashInput(input),
        sessionId:     options.context?.sessionId,
        doctorId:      options.context?.doctorId,
        output,
        durationMs:    Date.now() - startTime,
        configVersion: config.version,
      })
    ).catch(err => console.error('[RiskEngine] Logging hook error:', err))
  }

  return output
}

// ─── Config Comparison (للاختبار قبل نشر أوزان جديدة) ───────────────────────

export function compareConfigs(
  input:   RiskEngineInput,
  configA: Partial<RiskEngineConfig>,
  configB: Partial<RiskEngineConfig>,
) {
  const a = evaluateRisk(input, { config: configA })
  const b = evaluateRisk(input, { config: configB })
  return {
    scoreA:  a.riskScore,
    scoreB:  b.riskScore,
    delta:   b.riskScore - a.riskScore,
    levelA:  a.riskLevel,
    levelB:  b.riskLevel,
    changed: a.riskLevel !== b.riskLevel,
    flagsAdded:   b.flags.filter(f => !a.flags.includes(f)),
    flagsRemoved: a.flags.filter(f => !b.flags.includes(f)),
  }
}
