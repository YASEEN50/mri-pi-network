// src/app/page.tsx — Authenticated home (guests see pi.html via middleware)
export const dynamic = 'force-dynamic'

import { getTranslations } from 'next-intl/server'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'
import Footer from '@/components/common/Footer'
import HomeHeroSearch from '@/components/home/HomeHeroSearch'
import HomePublicationsFeed from '@/components/home/HomePublicationsFeed'
import HomeAdsSidebar from '@/components/home/HomeAdsSidebar'
import HomeHeroActions from '@/components/home/HomeHeroActions'
import DoctorCard from '@/components/doctors/DoctorCard'
import FacilityCard from '@/components/facilities/FacilityCard'
import { prisma } from '@/lib/prisma'
import { ApprovalStatus, Role } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { listPublicDoctors } from '@/lib/premio/list-doctors'
import { doctorProfilePublicWhere, expireStalePremios } from '@/lib/premio/active-premio'
import { getHomePublications } from '@/lib/home/get-home-publications'
import { getActiveHomeSidebarAds } from '@/lib/home/get-home-ads'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('DB_TIMEOUT')), ms),
    ),
  ])
}

async function getFeaturedDoctors() {
  return listPublicDoctors({ take: 6 })
}

async function getFeaturedFacilities() {
  return prisma.facilityProfile.findMany({
    where: { approvalStatus: ApprovalStatus.APPROVED, deletedAt: null },
    orderBy: { averageRating: 'desc' },
    take: 4,
  })
}

async function getStats() {
  await expireStalePremios()
  const [doctors, facilities, appointments] = await Promise.all([
    prisma.doctorProfile.count({ where: doctorProfilePublicWhere() }),
    prisma.facilityProfile.count({ where: { approvalStatus: ApprovalStatus.APPROVED } }),
    prisma.appointment.count({ where: { deletedAt: null } }),
  ])
  return { doctors, facilities, appointments }
}

export default async function HomePage() {
  const t = await getTranslations()
  const locale = await getLocale() as 'ar' | 'en'
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login?site=full')
  }
  const role = session.user.role as Role
  const isLoggedIn = true

  let doctors: Awaited<ReturnType<typeof getFeaturedDoctors>> = []
  let facilities: Awaited<ReturnType<typeof getFeaturedFacilities>> = []
  let publications: Awaited<ReturnType<typeof getHomePublications>> = []
  let sidebarAds: Awaited<ReturnType<typeof getActiveHomeSidebarAds>> = []
  let stats = { doctors: 0, facilities: 0, appointments: 0 }

  try {
    ;[doctors, facilities, stats] = await withTimeout(
      Promise.all([getFeaturedDoctors(), getFeaturedFacilities(), getStats()]),
      4000,
    )
  } catch (e) {
    console.error('[HomePage] core data error:', e)
  }

  try {
    publications = await withTimeout(getHomePublications(8), 4000)
  } catch (e) {
    console.error('[HomePage] publications error:', e)
  }

  try {
    sidebarAds = await withTimeout(getActiveHomeSidebarAds(4), 4000)
  } catch (e) {
    console.error('[HomePage] sidebar ads error:', e)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar locale={locale} />

      {/* Hero */}
      <section className="relative overflow-hidden mpi-grid-bg mpi-hero-glow">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/25 rounded-full text-accent text-sm mb-8">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse-soft" />
            {locale === 'ar' ? 'MRI — منصة طبية موثوقة' : 'MRI — Trusted Medical Platform'}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
            {t('home.hero_title')}
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
            {t('home.hero_subtitle')}
          </p>

          <div className="mb-8 px-4">
            <HomeHeroSearch />
          </div>

          <HomeHeroActions locale={locale} role={role} isLoggedIn={isLoggedIn} />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mt-16">
            {[
              { value: stats.doctors,      label: t('home.stats_doctors'),      icon: '👨‍⚕️' },
              { value: stats.facilities,   label: t('home.stats_facilities'),   icon: '🏥' },
              { value: stats.appointments, label: t('home.stats_appointments'), icon: '📅' },
            ].map((s, i) => (
              <div key={i} className="mpi-card p-4 text-center animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <p className="text-2xl font-bold text-white">{s.value.toLocaleString()}+</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feed + Ads */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full border-t border-white/5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-8 lg:gap-10 items-start">
          <HomePublicationsFeed publications={publications} locale={locale} />
          <HomeAdsSidebar ads={sidebarAds} locale={locale} />
        </div>
      </section>

      {/* Featured Doctors */}
      {doctors.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full animate-fade-in">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">{t('home.featured_doctors')}</h2>
            <Link href="/doctors" className="text-sm text-accent hover:text-white transition-colors">
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
                premioTier={d.premioTier}
              />
            ))}
          </div>
        </section>
      )}

      {/* Featured Facilities */}
      {facilities.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-white/5 w-full">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">{t('home.featured_facilities')}</h2>
            <Link href="/facilities" className="text-sm text-accent hover:text-white transition-colors">
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

      <Footer locale={locale} />
    </div>
  )
}
