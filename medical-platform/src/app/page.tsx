// src/app/page.tsx
import { getTranslations } from 'next-intl/server'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'
import DoctorCard from '@/components/doctors/DoctorCard'
import FacilityCard from '@/components/facilities/FacilityCard'
import { prisma } from '@/infrastructure/database/prisma/client'
import { ApprovalStatus } from '@prisma/client'

async function getFeaturedDoctors() {
  return prisma.doctorProfile.findMany({
    where: { approvalStatus: ApprovalStatus.APPROVED, deletedAt: null },
    orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }],
    take: 6,
  })
}

async function getFeaturedFacilities() {
  return prisma.facilityProfile.findMany({
    where: { approvalStatus: ApprovalStatus.APPROVED, deletedAt: null },
    orderBy: { averageRating: 'desc' },
    take: 4,
  })
}

async function getStats() {
  const [doctors, facilities, appointments] = await Promise.all([
    prisma.doctorProfile.count({ where: { approvalStatus: ApprovalStatus.APPROVED } }),
    prisma.facilityProfile.count({ where: { approvalStatus: ApprovalStatus.APPROVED } }),
    prisma.appointment.count({ where: { deletedAt: null } }),
  ])
  return { doctors, facilities, appointments }
}

export default async function HomePage() {
  const t = await getTranslations()
  const locale = await getLocale() as 'ar' | 'en'
  const [doctors, facilities, stats] = await Promise.all([
    getFeaturedDoctors(),
    getFeaturedFacilities(),
    getStats(),
  ])

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar locale={locale} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.04)_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/8 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {locale === 'ar' ? 'المنصة الطبية الموثوقة' : 'Trusted Medical Platform'}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            {t('home.hero_title')}
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
            {t('home.hero_subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/doctors"
              className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/25 text-sm">
              {t('home.hero_cta')}
            </Link>
            <Link href="/register"
              className="px-8 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-semibold rounded-xl transition-all text-sm">
              {t('home.hero_cta_secondary')}
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto mt-16">
            {[
              { value: stats.doctors,      label: t('home.stats_doctors') },
              { value: stats.facilities,   label: t('home.stats_facilities') },
              { value: stats.appointments, label: t('home.stats_appointments') },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl font-bold text-white">{s.value.toLocaleString()}+</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Doctors */}
      {doctors.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">{t('home.featured_doctors')}</h2>
            <Link href="/doctors" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
              {t('common.show_more')} →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
        </section>
      )}

      {/* Featured Facilities */}
      {facilities.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-white/5">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">{t('home.featured_facilities')}</h2>
            <Link href="/facilities" className="text-sm text-teal-400 hover:text-teal-300 transition-colors">
              {t('common.show_more')} →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {facilities.map((f) => (
              <FacilityCard
                key={f.id}
                id={f.id}
                name={f.name}
                type={f.type}
                city={f.city}
                averageRating={Number(f.averageRating)}
                totalReviews={f.totalReviews}
                phone={f.phone ?? undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} {locale === 'ar' ? 'المنصة الطبية' : 'MedPlatform'}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
