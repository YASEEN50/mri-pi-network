import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import PublicationFeedCard from '@/components/home/PublicationFeedCard'
import type { HomePublication } from '@/lib/home/get-home-publications'

interface HomePublicationsFeedProps {
  publications: HomePublication[]
  locale: 'ar' | 'en'
}

export default async function HomePublicationsFeed({ publications, locale }: HomePublicationsFeedProps) {
  const t = await getTranslations('home')

  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('feed_title')}</h2>
          <p className="text-slate-400 text-sm mt-1">{t('feed_subtitle')}</p>
        </div>
        <Link href="/publications" className="text-sm text-accent hover:text-white transition-colors shrink-0">
          {t('feed_view_all')} →
        </Link>
      </div>

      {publications.length === 0 ? (
        <div className="mpi-card p-10 text-center">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-slate-400 text-sm">{t('feed_empty')}</p>
          <Link href="/publications" className="inline-block mt-4 text-accent text-sm hover:underline">
            {t('feed_view_all')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {publications.map((pub) => (
            <PublicationFeedCard key={pub.id} pub={pub} locale={locale} />
          ))}
        </div>
      )}
    </section>
  )
}
