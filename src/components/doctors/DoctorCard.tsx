'use client'
// src/components/doctors/DoctorCard.tsx

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/cn'

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
  isVerified?: boolean
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <svg key={star} className={cn('w-3.5 h-3.5', star <= Math.round(rating) ? 'text-warning' : 'text-slate-700')} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export default function DoctorCard({
  id, fullName, specialization, city,
  consultationFee, averageRating, totalReviews, yearsOfExperience, avatarUrl,
  isVerified = true,
}: DoctorCardProps) {
  const t = useTranslations()

  return (
    <div className="group mpi-card-hover p-5">
      <div className="flex items-start gap-4">
        <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-accent/15 border border-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={fullName} fill className="object-cover" unoptimized />
          ) : (
            <span className="text-xl font-bold text-accent">{fullName[0]}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-white truncate group-hover:text-accent transition-colors">
              {fullName}
            </h3>
            {isVerified && <Badge variant="success" dot>معتمد</Badge>}
          </div>
          <p className="text-primary-400 text-sm mt-0.5">{specialization}</p>
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

      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
        <StarRating rating={averageRating} />
        <span className="text-sm font-semibold text-white">{averageRating.toFixed(1)}</span>
        <span className="text-xs text-slate-500">({totalReviews})</span>
        <span className="text-xs text-slate-500 ms-auto">{yearsOfExperience} {t('doctors.experience')}</span>
      </div>

      {consultationFee && (
        <p className="text-sm font-semibold text-accent mt-2">
          {consultationFee} {t('common.sar')}
        </p>
      )}

      <div className="flex gap-2 mt-4">
        <Link href={`/doctors/${id}`}
          className="flex-1 text-center py-2 text-sm border border-white/10 hover:border-primary/40 text-slate-300 hover:text-white rounded-xl transition-all">
          {t('doctors.view_profile')}
        </Link>
        <Link href={`/doctors/${id}?book=true`}
          className="flex-1 text-center py-2 text-sm bg-primary/20 hover:bg-primary/30 border border-primary/30 hover:border-accent/40 text-accent hover:text-white rounded-xl transition-all font-medium">
          {t('doctors.book_appointment')}
        </Link>
      </div>
    </div>
  )
}
