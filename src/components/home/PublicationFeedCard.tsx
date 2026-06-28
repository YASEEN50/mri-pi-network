import Link from 'next/link'
import Image from 'next/image'
import { publicationTypeLabel, PUBLICATION_TYPE_COLORS } from '@/lib/publications/constants'
import type { HomePublication } from '@/lib/home/get-home-publications'

interface PublicationFeedCardProps {
  pub: HomePublication
  locale: 'ar' | 'en'
  compact?: boolean
}

export default function PublicationFeedCard({ pub, locale, compact }: PublicationFeedCardProps) {
  const authorName = pub.doctor
    ? locale === 'ar'
      ? `د. ${pub.doctor.firstName} ${pub.doctor.lastName}`
      : `Dr. ${pub.doctor.firstName} ${pub.doctor.lastName}`
    : null

  return (
    <Link
      href={`/publications/${pub.id}`}
      className="mpi-card overflow-hidden hover:border-primary/30 transition-all group block h-full"
    >
      {pub.coverUrl && !compact && (
        <div className="h-44 overflow-hidden relative">
          <Image
            src={pub.coverUrl}
            alt={pub.title}
            width={640}
            height={176}
            unoptimized
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${PUBLICATION_TYPE_COLORS[pub.type] ?? ''}`}>
            {publicationTypeLabel(pub.type, locale)}
          </span>
          {pub.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded">
              #{tag}
            </span>
          ))}
        </div>
        <h3 className="text-white font-semibold text-base mb-2 line-clamp-2 group-hover:text-accent transition-colors">
          {pub.title}
        </h3>
        {pub.summary && (
          <p className={`text-slate-400 line-clamp-2 mb-3 ${compact ? 'text-xs' : 'text-sm'}`}>
            {pub.summary}
          </p>
        )}
        <div className="flex items-center justify-between pt-3 border-t border-white/5 gap-3">
          <div className="min-w-0">
            {authorName && (
              <p className="text-slate-300 text-xs truncate">{authorName}</p>
            )}
            {pub.doctor?.specialization && (
              <p className="text-slate-500 text-xs truncate">{pub.doctor.specialization}</p>
            )}
          </div>
          <div className="flex items-center gap-3 text-slate-500 text-xs shrink-0">
            <span>👁 {pub.viewCount}</span>
            {pub.publishedAt && (
              <span>{new Date(pub.publishedAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
