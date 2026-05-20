// src/lib/risk-engine/index.ts
export { evaluateRisk, compareConfigs }                  from './riskEngine'
export { DEFAULT_CONFIG, mergeConfig,
         loadConfigFromDB, seedRiskEngineConfig }        from './config'
export { RULE_REGISTRY, RULE_MAP, evaluateAllRules }     from './rules'
export { stringSimilarity, isExpired, daysUntilExpiry,
         clamp, scoreToTier, hashInput }                 from './scoring'

export type {
  RiskEngineInput, RiskEngineOutput, RiskEngineConfig,
  RiskTier, FlagCode, RuleCategory,
  ScoreBreakdown, CategorySummary,
  RuleDefinition, RuleEvaluation,
  LoggingHook, RiskEngineLogEntry,
  WeightOverrides, ThresholdConfig, ScoreThresholds,
} from './types'
export type { RuleEntry } from './rules'
