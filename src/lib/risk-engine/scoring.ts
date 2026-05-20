// src/lib/risk-engine/scoring.ts
// =============================================================================
// دوال نقية للحساب — تتوافق مع normalization الموجود في ocr.service.ts
// =============================================================================

import { createHash } from 'crypto'
import type { RiskTier, ScoreThresholds } from './types'

// ─── String Similarity (Levenshtein + Token matching) ────────────────────────
// تطابق مع normalizeArabicName() في ocr.service.ts

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function normalizeArabic(s: string): string {
  return s
    .trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ةه]/g,   'ه')
    .replace(/[يى]/g,   'ي')
    .replace(/[^ا-يa-z\s]/g, '')
}

export function stringSimilarity(a: string, b: string): number {
  const na = normalizeArabic(a)
  const nb = normalizeArabic(b)

  if (!na || !nb) return 0
  if (na === nb)  return 100

  // Token-based (اسم جزئي)
  const setA   = new Set(na.split(' '))
  const tokensB = nb.split(' ')
  const matched = tokensB.filter(t => setA.has(t)).length
  const tokenScore = Math.round((matched / Math.max(setA.size, tokensB.length)) * 100)

  // Levenshtein
  const dist   = levenshtein(na, nb)
  const levScore = Math.round((1 - dist / Math.max(na.length, nb.length)) * 100)

  return Math.max(tokenScore, levScore)
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

export function isExpired(isoDate: string | null): boolean {
  if (!isoDate) return false
  return new Date(isoDate) < new Date()
}

export function daysUntilExpiry(isoDate: string | null): number | null {
  if (!isoDate) return null
  return Math.floor((new Date(isoDate).getTime() - Date.now()) / 86_400_000)
}

// ─── Score Normalization ──────────────────────────────────────────────────────

export function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function scoreToTier(score: number, thresholds: ScoreThresholds): RiskTier {
  if (score <= thresholds.low)    return 'LOW'
  if (score <= thresholds.medium) return 'MEDIUM'
  return 'HIGH'
}

// adminPriority: 1 = أعلى أولوية (HIGH)، 3 = أدنى أولوية (LOW)
export function tierToPriority(tier: RiskTier): number {
  return tier === 'HIGH' ? 1 : tier === 'MEDIUM' ? 2 : 3
}

export function tierToRecommendation(tier: RiskTier): string {
  switch (tier) {
    case 'HIGH':   return 'مشبوه — مراجعة دقيقة ومقارنة يدوية إلزامية'
    case 'MEDIUM': return 'يحتاج تدقيق — راجع بيانات الرخصة والوجه بعناية'
    case 'LOW':    return 'بيانات جيدة — مراجعة سريعة كافية'
  }
}

// ─── Input Hashing (للـ logging) ─────────────────────────────────────────────

export function hashInput(input: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')
    .slice(0, 16)
}
