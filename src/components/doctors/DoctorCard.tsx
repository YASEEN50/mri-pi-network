'use client'
// src/components/doctors/DoctorCard.tsx
import Image from 'next/image'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

interface DoctorCardProps {
  id: string
  fullName: string
  specialization: string
  city?: string
  consultationFee?: number
  averageRating: number
  totalReviews: number
  yearsOfExperience: number
  avatarUrl?: string
}

export default function DoctorCard({
  id, fullName, specialization, city,
  consultationFee, averageRating, totalReviews, yearsOfExperience, avatarUrl,
}: DoctorCardProps) {
  const t = useTranslations()

  return (
    <div className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-emerald-500/30 rounded-2xl p-5 transition-all duration-300">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={fullName} fill className="object-cover" unoptimized />
          ) : (
            <span className="text-xl font-bold text-emerald-400">{fullName[0]}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
            {fullName}
          </h3>
          <p className="text-emerald-400/80 text-sm mt-0.5">{specialization}</p>
          {city && (
            <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {city}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-sm font-semibold text-white">{averageRating.toFixed(1)}</span>
          <span className="text-xs text-slate-500">({totalReviews})</span>
        </div>
        <div className="text-xs text-slate-400">
          {yearsOfExperience} {t('doctors.experience')}
        </div>
        {consultationFee && (
          <div className="ms-auto text-sm font-semibold text-emerald-400">
            {consultationFee} {t('common.sar')}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <Link
          href={`/doctors/${id}`}
          className="flex-1 text-center py-2 text-sm border border-white/10 hover:border-emerald-500/40 text-slate-300 hover:text-white rounded-xl transition-all"
        >
          {t('doctors.view_profile')}
        </Link>
        <Link
          href={`/doctors/${id}?book=true`}
          className="flex-1 text-center py-2 text-sm bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 hover:text-emerald-300 rounded-xl transition-all font-medium"
        >
          {t('doctors.book_appointment')}
        </Link>
      </div>
    </div>
  )
}
