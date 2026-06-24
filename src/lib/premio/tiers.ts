import { PremioType } from '@prisma/client'

export type PremioTier = 'BASIC' | 'PRO' | 'ELITE'

export type AnalyticsLevel = 'basic' | 'full' | 'advanced'

export interface PremioTierMeta {
  tier: PremioTier
  sortWeight: number
  badge: boolean
  badgeLabel: { ar: string; en: string }
  badgeVariant: 'pro' | 'elite'
  featuredBoost: boolean
  analyticsLevel: AnalyticsLevel
}

const TIER_META: Record<PremioTier, PremioTierMeta> = {
  BASIC: {
    tier: 'BASIC',
    sortWeight: 1,
    badge: false,
    badgeLabel: { ar: '', en: '' },
    badgeVariant: 'pro',
    featuredBoost: false,
    analyticsLevel: 'basic',
  },
  PRO: {
    tier: 'PRO',
    sortWeight: 2,
    badge: true,
    badgeLabel: { ar: 'بريميو Pro', en: 'Premio Pro' },
    badgeVariant: 'pro',
    featuredBoost: true,
    analyticsLevel: 'full',
  },
  ELITE: {
    tier: 'ELITE',
    sortWeight: 3,
    badge: true,
    badgeLabel: { ar: 'بريميو Elite', en: 'Premio Elite' },
    badgeVariant: 'elite',
    featuredBoost: true,
    analyticsLevel: 'advanced',
  },
}

/** Map subscription type → visibility tier */
export function premioTypeToTier(type: PremioType): PremioTier {
  switch (type) {
    case PremioType.YEARLY:
      return 'PRO'
    case PremioType.LIFETIME:
      return 'ELITE'
    case PremioType.MONTHLY:
    case PremioType.FREE_GIFT:
    default:
      return 'BASIC'
  }
}

export function getTierMeta(tier: PremioTier): PremioTierMeta {
  return TIER_META[tier]
}

export function tierSortWeight(tier: PremioTier): number {
  return TIER_META[tier].sortWeight
}

/** Pick highest tier when multiple active premios exist */
export function pickHighestTier(types: PremioType[]): PremioTier {
  let best: PremioTier = 'BASIC'
  for (const type of types) {
    const tier = premioTypeToTier(type)
    if (tierSortWeight(tier) > tierSortWeight(best)) best = tier
  }
  return best
}

export function sortByPremioTier<
  T extends { averageRating: number | { toString(): string }; totalReviews: number; premioTier?: PremioTier | null },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const tierDiff =
      tierSortWeight(b.premioTier ?? 'BASIC') - tierSortWeight(a.premioTier ?? 'BASIC')
    if (tierDiff !== 0) return tierDiff
    const ratingDiff = Number(b.averageRating) - Number(a.averageRating)
    if (ratingDiff !== 0) return ratingDiff
    return b.totalReviews - a.totalReviews
  })
}

export const TIER_BENEFITS_ROWS = [
  { key: 'listing', basic: true, pro: true, elite: true },
  { key: 'badge', basic: false, pro: true, elite: true },
  { key: 'featured', basic: false, pro: true, elite: true },
  { key: 'analytics_basic', basic: true, pro: true, elite: true },
  { key: 'analytics_full', basic: false, pro: true, elite: true },
  { key: 'analytics_referrals', basic: false, pro: false, elite: true },
] as const
