import Link from 'next/link'
import Image from 'next/image'
import type { HomeSidebarAd } from '@/lib/home/get-home-ads'

interface HomeAdsSidebarProps {
  ads: HomeSidebarAd[]
  locale: 'ar' | 'en'
}

export default function HomeAdsSidebar({ ads, locale }: HomeAdsSidebarProps) {
  const isAr = locale === 'ar'

  return (
    <aside className="space-y-4 lg:sticky lg:top-24">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-white">
          {isAr ? 'إعلانات مدفوعة' : 'Sponsored'}
        </h2>
        <span className="text-[10px] uppercase tracking-wide text-slate-500 border border-white/10 px-2 py-0.5 rounded">
          Ad
        </span>
      </div>

      {ads.length === 0 ? (
        <div className="mpi-card p-5 text-center border-dashed border-white/15">
          <div className="text-3xl mb-2">📢</div>
          <p className="text-slate-400 text-sm mb-4">
            {isAr
              ? 'مساحة متاحة للإعلانات الطبية والتجارية المعتمدة'
              : 'Space available for approved medical and commercial ads'}
          </p>
          <Link
            href="/advertise"
            className="inline-flex px-4 py-2 rounded-xl text-sm font-medium bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-all"
          >
            {isAr ? 'أعلن معنا' : 'Advertise with us'}
          </Link>
        </div>
      ) : (
        ads.map((ad) => (
          <a
            key={ad.id}
            href={`/api/ads/${ad.id}/click`}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mpi-card block overflow-hidden hover:border-amber-500/30 transition-all group"
          >
            {ad.imageUrl && (
              <div className="h-32 overflow-hidden relative">
                <Image
                  src={ad.imageUrl}
                  alt={ad.title}
                  width={320}
                  height={128}
                  unoptimized
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            )}
            <div className="p-4">
              <p className="text-[10px] text-amber-400/80 mb-1">{isAr ? 'إعلان مدفوع' : 'Paid ad'}</p>
              <h3 className="text-white font-semibold text-sm mb-1 line-clamp-2 group-hover:text-amber-300 transition-colors">
                {ad.title}
              </h3>
              {ad.description && (
                <p className="text-slate-400 text-xs line-clamp-2">{ad.description}</p>
              )}
              <p className="text-slate-500 text-xs mt-2 truncate">{ad.advertiserName}</p>
            </div>
          </a>
        ))
      )}

      <Link
        href="/advertise"
        className="block w-full text-center px-4 py-3 rounded-xl text-sm font-medium bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
      >
        {isAr ? '→ اطلب إعلاناً مدفوعاً' : '→ Request a paid ad'}
      </Link>
    </aside>
  )
}
