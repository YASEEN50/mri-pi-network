'use client'
// src/components/facilities/FacilityCard.tsx

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import Badge from '@/components/ui/Badge'

interface FacilityCardProps {
  id: string
  name: string
  type: string
  city: string
  averageRating: number
  totalReviews: number
  phone?: string
  logoUrl?: string
}

export default function FacilityCard({
  id, name, type, city, averageRating, totalReviews, phone, logoUrl,
}: FacilityCardProps) {
  const t = useTranslations()
  const typeLabel = t(`facilities.types.${type}` as 'facilities.types.CLINIC')

  return (
    <div className="group mpi-card-hover p-5">
      <div className="flex items-start gap-4">
        <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {logoUrl ? (
            <Image src={logoUrl} alt={name} fill className="object-cover" unoptimized />
          ) : (
            <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white truncate group-hover:text-accent transition-colors">{name}</h3>
          <Badge variant="accent" className="mt-1">{typeLabel}</Badge>
          <p className="text-slate-500 text-xs mt-2 flex items-center gap-1">
            📍 {city}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
        <svg className="w-4 h-4 text-warning" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span className="text-sm font-semibold text-white">{averageRating.toFixed(1)}</span>
        <span className="text-xs text-slate-500">({totalReviews})</span>
        {phone && <span className="text-xs text-slate-500 ms-auto" dir="ltr">{phone}</span>}
      </div>

      <Link href={`/facilities/${id}`}
        className="block mt-4 text-center py-2 text-sm bg-primary/15 hover:bg-primary/25 border border-primary/25 text-primary-400 hover:text-white rounded-xl transition-all font-medium">
        {t('common.show_more')}
      </Link>
    </div>
  )
}
