'use client'
// src/components/facilities/FacilityCard.tsx

import Link from 'next/link'
import { useTranslations } from 'next-intl'

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
  const typeLabel = t(`facilities.types.${type}` as any)

  return (
    <div className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-teal-500/30 rounded-2xl p-5 transition-all duration-300">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-400/20 to-blue-500/20 border border-teal-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {logoUrl
            ? <img src={logoUrl} alt={name} className="w-full h-full object-cover" />
            : <svg className="w-7 h-7 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white truncate group-hover:text-teal-400 transition-colors">{name}</h3>
          <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full">
            {typeLabel}
          </span>
          <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            {city}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-sm font-semibold text-white">{averageRating.toFixed(1)}</span>
          <span className="text-xs text-slate-500">({totalReviews})</span>
        </div>
        <Link href={`/facilities/${id}`}
          className="px-4 py-1.5 text-sm bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-400 rounded-xl transition-all">
          {t('doctors.view_profile')}
        </Link>
      </div>
    </div>
  )
}
