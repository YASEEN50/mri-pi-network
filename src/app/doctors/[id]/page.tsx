// src/app/doctors/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import Navbar from '@/components/common/Navbar'
import AppointmentForm from '@/components/appointments/AppointmentForm'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'

const LANGUAGE_LABELS: Record<string, string> = {
  ar: 'العربية', en: 'English', fr: 'Français',
  ur: 'اردو', hi: 'हिन्दी', tr: 'Türkçe',
}

const STAR = (filled: boolean) => (
  <svg className={`w-4 h-4 ${filled ? 'text-amber-400' : 'text-slate-700'}`} fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
  </svg>
)

export default async function DoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const locale  = await getLocale() as 'ar' | 'en'

  const doctor = await prisma.doctorProfile.findFirst({
    where: { id, deletedAt: null, approvalStatus: 'APPROVED' },
    include: {
      credentials: { where: { deletedAt: null }, orderBy: { year: 'desc' } },
      reviews: {
        where: { isVisible: true, deletedAt: null },
        take: 6, orderBy: { createdAt: 'desc' },
        include: { client: { include: { clientProfile: { select: { firstName: true, lastName: true } } } } },
      },
      publications: {
        where: { status: 'PUBLISHED', deletedAt: null },
        take: 3, orderBy: { publishedAt: 'desc' },
        select: { id: true, title: true, type: true, viewCount: true, publishedAt: true },
      },
      availability: { where: { isActive: true }, orderBy: { dayOfWeek: 'asc' } },
    },
  })

  if (!doctor) notFound()

  const rating    = Number(doctor.averageRating)
  const fee       = doctor.consultationFee ? Number(doctor.consultationFee) : null
  const initials  = `${doctor.firstName[0]}${doctor.lastName?.[0] ?? ''}`

  // توزيع التقييمات
  const ratingDist = [5,4,3,2,1].map((s: any) => ({
    star: s,
    count: doctor.reviews.filter((r: any) => r.rating === s).length,
    pct: doctor.reviews.length > 0
      ? Math.round((doctor.reviews.filter((r: any) => r.rating === s).length / doctor.reviews.length) * 100)
      : 0,
  }))

  const DAY_LABELS: Record<string,string> = {
    SUNDAY:'الأحد', MONDAY:'الاثنين', TUESDAY:'الثلاثاء',
    WEDNESDAY:'الأربعاء', THURSDAY:'الخميس', FRIDAY:'الجمعة', SATURDAY:'السبت',
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <Navbar locale={locale} />

      {/* Hero Banner */}
      <div className="relative overflow-hidden mpi-hero-glow border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 relative animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="relative flex-shrink-0">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl overflow-hidden flex items-center justify-center text-4xl font-bold bg-gradient-to-br from-primary/25 to-accent/15 border-2 border-primary/30">
                {doctor.avatarUrl
                  ? <Image src={doctor.avatarUrl} alt={doctor.firstName} width={144} height={144} unoptimized className="w-full h-full object-cover" />
                  : <span className="text-accent">{initials}</span>
                }
              </div>
              <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center text-sm bg-success border-2 border-background">
                ✓
              </div>
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-success/15 text-success border border-success/30">
                  طبيب معتمد ✓
                </span>
                {doctor.piKycVerified && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/25">
                    🟣 Pi KYC
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                د. {doctor.firstName} {doctor.lastName}
              </h1>
              <p className="text-lg mb-0.5 text-accent">{doctor.specialization}</p>
              {doctor.subSpecialization && (
                <p className="text-slate-400 text-sm mb-3">{doctor.subSpecialization}</p>
              )}

              {/* Stats Row */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center gap-1.5">
                  <div className="flex">{[1,2,3,4,5].map((s: any) => <span key={s}>{STAR(s <= Math.round(rating))}</span>)}</div>
                  <span className="text-white font-bold">{rating.toFixed(1)}</span>
                  <span className="text-slate-500 text-sm">({doctor.totalReviews} تقييم)</span>
                </div>
                <span className="text-slate-600">·</span>
                <span className="text-slate-300 text-sm">{doctor.yearsOfExperience} سنة خبرة</span>
                {doctor.city && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400 text-sm">📍 {doctor.city}</span>
                  </>
                )}
                <span className="text-slate-600">·</span>
                <span className="text-slate-400 text-sm">{doctor.totalAppointments} موعد</span>
              </div>

              {/* Languages */}
              {doctor.languages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {doctor.languages.map((l: any) => (
                    <span key={l} className="text-xs px-2.5 py-1 rounded-lg bg-white/5 text-slate-400 border border-white/10">
                      🌐 {LANGUAGE_LABELS[l] ?? l}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Fee Badge */}
            {fee && (
              <div className="flex-shrink-0 text-center px-6 py-4 rounded-2xl hidden sm:block bg-primary/10 border border-primary/25">
                <p className="text-slate-400 text-xs mb-1">رسوم الاستشارة</p>
                <p className="text-3xl font-bold text-accent">{fee}</p>
                <p className="text-slate-400 text-xs mt-1">ريال سعودي</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ═══════════════ العمود الرئيسي ═══════════════ */}
          <div className="lg:col-span-2 space-y-5">

            {/* نبذة */}
            {doctor.bio && (
              <div className="rounded-2xl p-6 mpi-card">
                <h2 className="text-white font-bold mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full inline-block bg-accent"></span>
                  نبذة عن الطبيب
                </h2>
                <p className="text-slate-300 leading-relaxed text-sm">{doctor.bio}</p>
              </div>
            )}

            {/* أوقات العمل */}
            {doctor.availability.length > 0 && (
              <div className="rounded-2xl p-6 mpi-card">
                <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full inline-block bg-primary"></span>
                  أوقات العمل
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {doctor.availability.map((a: any) => (
                    <div key={a.id} className="rounded-xl p-3 text-center bg-primary/10 border border-primary/20">
                      <p className="text-white text-sm font-medium mb-1">{DAY_LABELS[a.dayOfWeek]}</p>
                      <p className="text-xs text-accent">{a.startTime} - {a.endTime}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{a.slotMinutes} دقيقة/موعد</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* المؤهلات العلمية */}
            {doctor.credentials.length > 0 && (
              <div className="rounded-2xl p-6 mpi-card">
                <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full inline-block bg-warning"></span>
                  المؤهلات والشهادات العلمية
                </h2>
                <div className="space-y-3">
                  {doctor.credentials.map((c: any) => (
                    <div key={c.id} className="flex items-start gap-4 p-4 rounded-xl bg-warning/5 border border-warning/15">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-warning/15">
                        🎓
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{c.title}</p>
                        <p className="text-slate-400 text-sm mt-0.5">{c.institution}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-slate-500 text-xs">📅 {c.year}</span>
                          <span className="text-slate-500 text-xs">🌍 {c.country}</span>
                          {c.isVerified && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success">
                              ✓ موثّق
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* المنشورات الطبية */}
            {doctor.publications.length > 0 && (
              <div className="rounded-2xl p-6 mpi-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-bold flex items-center gap-2">
                    <span className="w-1 h-5 rounded-full inline-block bg-secondary"></span>
                    المنشورات الطبية
                  </h2>
                  <Link href="/publications" className="text-xs text-secondary-300 hover:text-secondary-200">عرض الكل ←</Link>
                </div>
                <div className="space-y-3">
                  {doctor.publications.map((p: any) => (
                    <Link key={p.id} href={`/publications/${p.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-white/5 border border-white/5">
                      <span className="text-xl flex-shrink-0">
                        {p.type === 'RESEARCH' ? '🔬' : p.type === 'CASE_STUDY' ? '📊' : '📝'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{p.title}</p>
                        <p className="text-slate-500 text-xs mt-0.5">👁 {p.viewCount} · {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('ar-SA') : ''}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* التقييمات */}
            {(doctor.reviews.length > 0 || doctor.totalReviews > 0) && (
              <div className="rounded-2xl p-6 mpi-card">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-white font-bold flex items-center gap-2">
                    <span className="w-1 h-5 rounded-full inline-block bg-warning"></span>
                    تقييمات المرضى
                  </h2>
                  <Link href={`/doctors/${doctor.id}/reviews`} className="text-xs text-warning hover:text-amber-300">
                    كل التقييمات ({doctor.totalReviews}) ←
                  </Link>
                </div>

                <div className="flex flex-col sm:flex-row gap-6 mb-6 p-5 rounded-2xl bg-warning/5 border border-warning/10">
                  <div className="text-center">
                    <p className="text-5xl font-bold mb-1 text-warning">{rating.toFixed(1)}</p>
                    <div className="flex justify-center mb-1">
                      {[1,2,3,4,5].map((s: any) => <span key={s}>{STAR(s <= Math.round(rating))}</span>)}
                    </div>
                    <p className="text-slate-400 text-xs">{doctor.totalReviews} تقييم</p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {ratingDist.map((d: any) => (
                      <div key={d.star} className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs w-4">{d.star}</span>
                        <span className="text-amber-400 text-xs">★</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden bg-white/10">
                          <div className="h-full rounded-full bg-warning" style={{width:`${d.pct}%`}} />
                        </div>
                        <span className="text-slate-500 text-xs w-6">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* قائمة التقييمات */}
                <div className="space-y-4">
                  {doctor.reviews.map((r: any) => (
                    <div key={r.id} className="pb-4 border-b border-white/5 last:border-0">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-success/15 text-success">
                          {r.client.clientProfile?.firstName?.[0] ?? 'م'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-white text-sm font-medium">
                              {r.client.clientProfile
                                ? `${r.client.clientProfile.firstName} ${r.client.clientProfile.lastName}`
                                : 'مريض'}
                            </p>
                            <div className="flex">
                              {[1,2,3,4,5].map((s: any) => <span key={s}>{STAR(s <= r.rating)}</span>)}
                            </div>
                          </div>
                          {r.comment && (
                            <p className="text-slate-300 text-sm mt-1 leading-relaxed">{r.comment}</p>
                          )}
                          <p className="text-slate-600 text-xs mt-1.5">
                            {new Date(r.createdAt).toLocaleDateString('ar-SA')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ═══════════════ العمود الجانبي ═══════════════ */}
          <div className="lg:col-span-1 space-y-4">

            {/* بطاقة الحجز */}
            <div id="booking" className="rounded-2xl overflow-hidden scroll-mt-24 mpi-card">
              <div className="p-5 border-b border-white/5 bg-primary/10">
                <h3 className="text-white font-bold text-lg mb-1">حجز موعد</h3>
                {fee && (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-accent">{fee}</span>
                    <span className="text-slate-400 text-sm">ريال</span>
                  </div>
                )}
                {doctor.paymentPolicy && (
                  <p className="text-slate-500 text-xs mt-1">
                    {({PAY_BEFORE_BOOKING:'دفع مسبق', DEPOSIT_AND_PAY_LATER:'إيداع مسبق', PAY_ON_SERVICE:'دفع عند الخدمة'} as Record<string,string>)[doctor.paymentPolicy as string]}
                  </p>
                )}
              </div>
              <div className="p-5">
                <AppointmentForm doctorId={doctor.id} />
              </div>
            </div>

            {/* معلومات الاتصال */}
            <div className="rounded-2xl p-5 mpi-card">
              <h3 className="text-white font-semibold mb-3 text-sm">معلومات التواصل</h3>
              <div className="space-y-2.5">
                {doctor.city && (
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📍</span>
                    <span className="text-slate-300 text-sm">{doctor.city}، {doctor.country}</span>
                  </div>
                )}
                {(doctor as any).phone && (
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📞</span>
                    <span className="text-slate-300 text-sm" dir="ltr">{(doctor as any).phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <span className="text-base">📄</span>
                  <span className="text-slate-400 text-xs">ترخيص: {doctor.licenseNumber}</span>
                </div>
              </div>
            </div>

            {/* إحصائيات سريعة */}
            <div className="rounded-2xl p-5 mpi-card">
              <h3 className="text-white font-semibold mb-3 text-sm">إحصائيات</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'سنوات الخبرة',  value: doctor.yearsOfExperience, icon: '🏅' },
                  { label: 'إجمالي المواعيد', value: doctor.totalAppointments, icon: '📅' },
                  { label: 'التقييمات',       value: doctor.totalReviews,      icon: '⭐' },
                  { label: 'المنشورات',       value: doctor.publications.length, icon: '📝' },
                ].map((s: any) => (
                  <div key={s.label} className="rounded-xl p-3 text-center bg-white/5">
                    <span className="text-xl block mb-1">{s.icon}</span>
                    <p className="text-white font-bold text-lg">{s.value}</p>
                    <p className="text-slate-500 text-xs">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
