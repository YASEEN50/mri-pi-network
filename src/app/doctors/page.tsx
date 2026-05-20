// src/app/doctors/page.tsx
import { getTranslations, getLocale } from 'next-intl/server'
import Navbar from '@/components/common/Navbar'
import DoctorCard from '@/components/doctors/DoctorCard'
import { prisma } from '@/lib/prisma'
import { ApprovalStatus } from '@prisma/client'

interface PageProps {
  searchParams: Promise<{ specialization?: string; city?: string; page?: string }>
}

export default async function DoctorsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const t = await getTranslations()
  const locale = await getLocale() as 'ar' | 'en'
  const page = Number(params.page ?? 1)
  const limit = 12

  const where: any = { approvalStatus: ApprovalStatus.APPROVED, deletedAt: null }
  if (params.specialization) where.specialization = { contains: params.specialization, mode: 'insensitive' }
  if (params.city) where.city = { contains: params.city, mode: 'insensitive' }

  const [doctors, total] = await Promise.all([
    prisma.doctorProfile.findMany({
      where,
      orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.doctorProfile.count({ where }),
  ])

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar locale={locale} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">{t('doctors.title')}</h1>
          <p className="text-slate-400 mt-2">{total} {locale === 'ar' ? 'طبيب مسجل' : 'doctors found'}</p>
        </div>

        {/* Search bar */}
        <form className="flex gap-3 mb-8" method="GET">
          <input name="specialization" defaultValue={params.specialization}
            placeholder={t('doctors.search_placeholder')}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-all" />
          <input name="city" defaultValue={params.city}
            placeholder={t('doctors.filter_city')}
            className="w-40 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-all" />
          <button type="submit"
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-medium transition-all">
            {t('common.search')}
          </button>
        </form>

        {doctors.length === 0 ? (
          <div className="text-center py-20 text-slate-400">{t('doctors.no_results')}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {doctors.map((d: any) => (
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

        {/* Pagination */}
        {total > limit && (
          <div className="flex justify-center gap-2 mt-10">
            {page > 1 && (
              <a href={`?page=${page - 1}`}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg text-sm transition-all">
                {t('common.previous')}
              </a>
            )}
            <span className="px-4 py-2 text-slate-400 text-sm">
              {page} {t('common.of')} {Math.ceil(total / limit)}
            </span>
            {page < Math.ceil(total / limit) && (
              <a href={`?page=${page + 1}`}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg text-sm transition-all">
                {t('common.next')}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
