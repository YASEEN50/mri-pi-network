// src/app/doctors/page.tsx
import { getTranslations, getLocale } from 'next-intl/server'
import Navbar from '@/components/common/Navbar'
import Footer from '@/components/common/Footer'
import DoctorCard from '@/components/doctors/DoctorCard'
import { prisma } from '@/lib/prisma'
import { doctorProfilePublicWhere, expireStalePremios } from '@/lib/premio/active-premio'

interface PageProps {
  searchParams: Promise<{ specialization?: string; city?: string; page?: string }>
}

export default async function DoctorsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const t = await getTranslations()
  const locale = await getLocale() as 'ar' | 'en'
  const page = Number(params.page ?? 1)
  const limit = 12

  await expireStalePremios()

  const where = doctorProfilePublicWhere({
    ...(params.specialization && { specialization: { contains: params.specialization, mode: 'insensitive' } }),
    ...(params.city && { city: { contains: params.city, mode: 'insensitive' } }),
  })

  const [doctors, total] = await Promise.all([
    prisma.doctorProfile.findMany({
      where,
      orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.doctorProfile.count({ where }),
  ])

  const qs = (p: number) => {
    const parts = [`page=${p}`]
    if (params.specialization) parts.push(`specialization=${encodeURIComponent(params.specialization)}`)
    if (params.city) parts.push(`city=${encodeURIComponent(params.city)}`)
    return `?${parts.join('&')}`
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar locale={locale} />

      <div className="relative mpi-grid-bg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
          <h1 className="text-3xl font-bold text-white">{t('doctors.title')}</h1>
          <p className="text-slate-400 mt-2">{total} {locale === 'ar' ? 'طبيب مسجل' : 'doctors found'}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full">
        <form className="flex flex-col sm:flex-row gap-3 mb-8 mpi-card p-4" method="GET">
          <input name="specialization" defaultValue={params.specialization}
            placeholder={t('doctors.search_placeholder')}
            className="flex-1 bg-surface/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all" />
          <input name="city" defaultValue={params.city}
            placeholder={t('doctors.filter_city')}
            className="sm:w-44 bg-surface/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-primary/50 transition-all" />
          <button type="submit"
            className="px-6 py-3 bg-primary hover:bg-primary-400 text-white rounded-xl text-sm font-medium transition-all shadow-glow-primary">
            {t('common.search')}
          </button>
        </form>

        {doctors.length === 0 ? (
          <div className="text-center py-20 mpi-card">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-slate-400">{t('doctors.no_results')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-slide-up">
            {doctors.map((d) => (
              <DoctorCard
                key={d.id}
                id={d.id}
                fullName={`${d.firstName} ${d.lastName}`}
                specialization={d.specialization}
                city={d.city ?? undefined}
                consultationFee={d.consultationFee ? Number(d.consultationFee) : undefined}
                averageRating={Number(d.averageRating)}
                totalReviews={d.totalReviews}
                yearsOfExperience={d.yearsOfExperience}
              />
            ))}
          </div>
        )}

        {total > limit && (
          <div className="flex justify-center gap-2 mt-10">
            {page > 1 && (
              <a href={qs(page - 1)}
                className="px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/25 text-accent rounded-lg text-sm transition-all">
                {t('common.previous')}
              </a>
            )}
            <span className="px-4 py-2 text-slate-400 text-sm">
              {page} {t('common.of')} {Math.ceil(total / limit)}
            </span>
            {page < Math.ceil(total / limit) && (
              <a href={qs(page + 1)}
                className="px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/25 text-accent rounded-lg text-sm transition-all">
                {t('common.next')}
              </a>
            )}
          </div>
        )}
      </div>

      <Footer locale={locale} />
    </div>
  )
}
