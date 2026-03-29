import { getTranslations, getLocale } from 'next-intl/server'
import Navbar from '@/components/common/Navbar'
import FacilityCard from '@/components/facilities/FacilityCard'
import { prisma } from '@/infrastructure/database/prisma/client'
import { ApprovalStatus, FacilityType } from '@prisma/client'

interface PageProps { searchParams: { type?: string; city?: string; page?: string } }

export default async function FacilitiesPage({ searchParams }: PageProps) {
  const t = await getTranslations()
  const locale = await getLocale() as 'ar' | 'en'
  const page = Number(searchParams.page ?? 1), limit = 12
  const where: any = { approvalStatus: ApprovalStatus.APPROVED, deletedAt: null }
  if (searchParams.type) where.type = searchParams.type as FacilityType
  if (searchParams.city) where.city = { contains: searchParams.city, mode: 'insensitive' }
  const [facilities, total] = await Promise.all([
    prisma.facilityProfile.findMany({ where, orderBy: [{ averageRating: 'desc' }], skip: (page-1)*limit, take: limit }),
    prisma.facilityProfile.count({ where }),
  ])
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar locale={locale} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">{t('facilities.title')}</h1>
          <p className="text-slate-400 mt-2">{total} {locale === 'ar' ? 'منشأة مسجلة' : 'facilities'}</p>
        </div>
        <form className="flex flex-wrap gap-3 mb-8" method="GET">
          <input name="city" defaultValue={searchParams.city} placeholder={locale === 'ar' ? 'المدينة...' : 'City...'}
            className="w-40 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500/60 transition-all" />
          <select name="type" defaultValue={searchParams.type ?? ''}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all">
            <option value="">{locale === 'ar' ? 'جميع الأنواع' : 'All Types'}</option>
            {Object.values(FacilityType).map((type) => (
              <option key={type} value={type}>{t(`facilities.types.${type}` as any)}</option>
            ))}
          </select>
          <button type="submit" className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-medium transition-all">
            {t('common.search')}
          </button>
        </form>
        {facilities.length === 0 ? (
          <div className="text-center py-20 text-slate-400">{t('doctors.no_results')}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {facilities.map((f) => (
              <FacilityCard key={f.id} id={f.id} name={f.name} type={f.type} city={f.city}
                averageRating={Number(f.averageRating)} totalReviews={f.totalReviews} phone={f.phone ?? undefined} />
            ))}
          </div>
        )}
        {total > limit && (
          <div className="flex justify-center gap-2 mt-10">
            {page > 1 && <a href={`?page=${page-1}`} className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-lg text-sm">{t('common.previous')}</a>}
            <span className="px-4 py-2 text-slate-400 text-sm">{page} {t('common.of')} {Math.ceil(total/limit)}</span>
            {page < Math.ceil(total/limit) && <a href={`?page=${page+1}`} className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-lg text-sm">{t('common.next')}</a>}
          </div>
        )}
      </div>
    </div>
  )
}
