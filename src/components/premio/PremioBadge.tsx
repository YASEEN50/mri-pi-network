'use client'

import { useLocale } from 'next-intl'
import { getTierMeta, PremioTier } from '@/lib/premio/tiers'
import { cn } from '@/lib/cn'

interface PremioBadgeProps {
  tier: PremioTier | null | undefined
  className?: string
  size?: 'sm' | 'md'
}

export default function PremioBadge({ tier, className, size = 'sm' }: PremioBadgeProps) {
  const locale = useLocale() as 'ar' | 'en'
  if (!tier || tier === 'BASIC') return null

  const meta = getTierMeta(tier)
  if (!meta.badge) return null

  const label = locale === 'ar' ? meta.badgeLabel.ar : meta.badgeLabel.en
  const isElite = meta.badgeVariant === 'elite'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full border whitespace-nowrap',
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        isElite
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-violet-500/15 text-violet-300 border-violet-500/30',
        className,
      )}
    >
      💎 {label}
    </span>
  )
}
