// src/app/facilities/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import Navbar from '@/components/common/Navbar'
import AppointmentForm from '@/components/appointments/AppointmentForm'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { ON_CALL_SHIFT_LABELS } from '@/lib/facility/department-catalog'

const FACILITY_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  HOSPITAL:           { label: 'مستشفى',              icon: '🏥', color: '#3b82f6' },
  CLINIC:             { label: 'عيادة',               icon: '🏪', color: '#10b981' },
  MEDICAL_CENTER:     { label: 'مركز طبي',            icon: '⚕️', color: '#6366f1' },
  LABORATORY:         { label: 'مختبر',               icon: '🧪', color: '#f59e0b' },
  PHARMACY:           { label: 'صيدلية',              icon: '💊', color: '#ec4899' },
  SCIENTIFIC_INSTITUTE:{ label: 'معهد علمي',          icon: '🔬', color: '#8b5cf6' },
  UNIVERSITY:         { label: 'جامعة',               icon: '🎓', color: '#14b8a6' },
  MEDICAL_COLLEGE:    { label: 'كلية طب',             icon: '📚', color: '#f97316' },
}

const STAR = (filled: boolean) => (
  <svg className={`w-4 h-4 ${filled ? 'text-amber-400' : 'text-slate-700'}`} fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
  </svg>
)

export default async function FacilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const locale  = await getLocale() as 'ar' | 'en'

  const facility = await prisma.facilityProfile.findFirst({
    where: { id, deletedAt: null, approvalStatus: 'APPROVED' },
    include: {
      doctors: {
        where: { isActive: true },
        include: {
          doctor: {
            select: {
              id: true, firstName: true, lastName: true,
              specialization: true, averageRating: true,
              totalReviews: true, avatarUrl: true, yearsOfExperience: true,
            },
          },
        },
        take: 12,
      },
      reviews: {
        where: { isVisible: true, deletedAt: null },
        take: 6, orderBy: { createdAt: 'desc' },
        include: { client: { include: { clientProfile: { select: { firstName: true, lastName: true } } } } },
      },
      availability: { where: { isActive: true }, orderBy: { dayOfWeek: 'asc' } },
    },
  })

  if (!facility) notFound()

  const now = new Date()
  const [departments, onCallNow] = await Promise.all([
    prisma.facilityDepartment.findMany({
      where: { facilityId: id, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, icon: true, floor: true, phone: true },
    }),
    prisma.onCallShift.findMany({
      where: {
        facilityId: id,
        isPublished: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      include: {
        department: { select: { name: true, icon: true } },
        doctor: { select: { firstName: true, lastName: true, specialization: true } },
      },
      orderBy: { startsAt: 'asc' },
    }),
  ])

  const typeInfo  = FACILITY_TYPE_LABELS[facility.type] ?? { label: facility.type, icon: '🏥', color: '#10b981' }
  const rating    = Number(facility.averageRating)
  const ratingDist = [5,4,3,2,1].map((s: any) => ({
    star: s,
    count: facility.reviews.filter((r: any) => r.rating === s).length,
    pct: facility.reviews.length > 0
      ? Math.round((facility.reviews.filter((r: any) => r.rating === s).length / facility.reviews.length) * 100) : 0,
  }))

  const DAY_LABELS: Record<string,string> = {
    SUNDAY:'الأحد', MONDAY:'الاثنين', TUESDAY:'الثلاثاء',
    WEDNESDAY:'الأربعاء', THURSDAY:'الخميس', FRIDAY:'الجمعة', SATURDAY:'السبت',
  }

  return (
    <div className="min-h-screen" style={{background:'#080c14'}} dir="rtl">
      <Navbar locale={locale} />

      {/* Hero */}
      <div className="relative overflow-hidden"
        style={{background:`linear-gradient(135deg, ${typeInfo.color}18 0%, #0a1220 50%, #080c14 100%)`}}>
        <div className="absolute inset-0 opacity-20"
          style={{backgroundImage:`radial-gradient(circle at 30% 50%, ${typeInfo.color}25 0%, transparent 60%)`}}>
        </div>

        {/* Cover Image */}
        {facility.coverUrl && (
          <div className="absolute inset-0 opacity-10">
            <Image src={facility.coverUrl} alt="" fill unoptimized className="object-cover" sizes="100vw" />
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 relative">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Logo */}
            <div className="relative flex-shrink-0">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl overflow-hidden flex items-center justify-center"
                style={{background:`${typeInfo.color}20`,border:`2px solid ${typeInfo.color}40`}}>
                {facility.logoUrl
                  ? <Image src={facility.logoUrl} alt={facility.name} width={144} height={144} unoptimized className="w-full h-full object-cover" />
                  : <span className="text-5xl">{typeInfo.icon}</span>
                }
              </div>
              <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center text-sm"
                style={{background:`${typeInfo.color}dd`,border:'2px solid #080c14'}}>
                ✓
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{background:`${typeInfo.color}20`,color:typeInfo.color,border:`1px solid ${typeInfo.color}35`}}>
                  {typeInfo.icon} {typeInfo.label}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full"
                  style={{background:'rgba(16,185,129,0.15)',color:'#34d399',border:'1px solid rgba(16,185,129,0.3)'}}>
                  معتمدة ✓
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{facility.name}</h1>

              <div className="flex flex-wrap items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="flex">{[1,2,3,4,5].map((s: any) => <span key={s}>{STAR(s <= Math.round(rating))}</span>)}</div>
                  <span className="text-white font-bold">{rating.toFixed(1)}</span>
                  <span className="text-slate-500 text-sm">({facility.totalReviews} تقييم)</span>
                </div>
                <span className="text-slate-600">·</span>
                <span className="text-slate-300 text-sm">
                  {facility.doctors.length} طبيب
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400 text-sm">📍 {facility.city}</span>
              </div>

              {/* Contact Row */}
              <div className="flex flex-wrap gap-3">
                {facility.phone && (
                  <a href={`tel:${facility.phone}`}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all"
                    style={{background:'rgba(255,255,255,0.06)',color:'#94a3b8',border:'1px solid rgba(255,255,255,0.1)'}}>
                    📞 <span dir="ltr">{facility.phone}</span>
                  </a>
                )}
                {facility.email && (
                  <a href={`mailto:${facility.email}`}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all"
                    style={{background:'rgba(255,255,255,0.06)',color:'#94a3b8',border:'1px solid rgba(255,255,255,0.1)'}}>
                    ✉️ {facility.email}
                  </a>
                )}
                {facility.website && (
                  <a href={facility.website} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all"
                    style={{background:'rgba(255,255,255,0.06)',color:'#94a3b8',border:'1px solid rgba(255,255,255,0.1)'}}>
                    🌐 الموقع الإلكتروني
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ═══ العمود الرئيسي ═══ */}
          <div className="lg:col-span-2 space-y-5">

            {/* نبذة */}
            {facility.description && (
              <div className="rounded-2xl p-6" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                <h2 className="text-white font-bold mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full inline-block" style={{background:typeInfo.color}}></span>
                  عن المنشأة
                </h2>
                <p className="text-slate-300 leading-relaxed text-sm">{facility.description}</p>
              </div>
            )}

            {/* أوقات العمل */}
            {facility.availability.length > 0 && (
              <div className="rounded-2xl p-6" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full inline-block" style={{background:'#3b82f6'}}></span>
                  أوقات العمل
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {facility.availability.map((a: any) => (
                    <div key={a.id} className="rounded-xl p-3 text-center"
                      style={{background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.15)'}}>
                      <p className="text-white text-sm font-medium mb-1">{DAY_LABELS[a.dayOfWeek]}</p>
                      <p className="text-xs" style={{color:'#60a5fa'}}>{a.startTime} - {a.endTime}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(onCallNow.length > 0 || departments.length > 0) && (
              <div className="rounded-2xl p-6" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full inline-block" style={{background:'#f43f5e'}}></span>
                  الأقسام والمناوبون
                </h2>

                {onCallNow.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <p className="text-rose-400 text-xs font-medium">● مناوب الآن</p>
                    {onCallNow.map((s) => (
                      <div key={s.id} className="rounded-xl p-3 flex items-center justify-between gap-3"
                        style={{background:'rgba(244,63,94,0.08)',border:'1px solid rgba(244,63,94,0.2)'}}>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {s.department.icon} {s.department.name}
                          </p>
                          <p className="text-slate-300 text-sm">
                            د. {s.doctor.firstName} {s.doctor.lastName} · {s.doctor.specialization}
                          </p>
                          <p className="text-slate-500 text-xs">
                            {ON_CALL_SHIFT_LABELS[s.shiftType]?.ar ?? s.shiftType}
                          </p>
                        </div>
                        <Link href={`/doctors/${s.doctorId}`}
                          className="text-xs px-3 py-1.5 rounded-lg shrink-0"
                          style={{background:'rgba(255,255,255,0.08)',color:'#fda4af'}}>
                          الملف
                        </Link>
                      </div>
                    ))}
                  </div>
                )}

                {departments.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {departments.map((d) => (
                      <div key={d.id} className="rounded-xl p-3 text-center"
                        style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)'}}>
                        <span className="text-xl">{d.icon ?? '🏥'}</span>
                        <p className="text-white text-sm font-medium mt-1">{d.name}</p>
                        {d.floor && <p className="text-slate-500 text-xs">طابق {d.floor}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* الأطباء */}
            {facility.doctors.length > 0 && (
              <div className="rounded-2xl p-6" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full inline-block" style={{background:'#10b981'}}></span>
                  الكادر الطبي ({facility.doctors.length} طبيب)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {facility.doctors.map((df: any) => (
                    <Link key={df.doctorId} href={`/doctors/${df.doctor.id}`}
                      className="flex items-center gap-3 p-4 rounded-xl transition-all hover:bg-white/5 group"
                      style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center font-bold flex-shrink-0"
                        style={{background:'rgba(16,185,129,0.15)',color:'#34d399'}}>
                        {df.doctor.avatarUrl
                          ? <Image src={df.doctor.avatarUrl} alt="" width={48} height={48} unoptimized className="w-full h-full object-cover" />
                          : df.doctor.firstName[0]
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate group-hover:text-emerald-400 transition-colors">
                          د. {df.doctor.firstName} {df.doctor.lastName}
                        </p>
                        <p className="text-slate-400 text-xs truncate">{df.doctor.specialization}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-amber-400 text-xs">⭐ {Number(df.doctor.averageRating).toFixed(1)}</span>
                          <span className="text-slate-600 text-xs">·</span>
                          <span className="text-slate-500 text-xs">{df.doctor.yearsOfExperience} سنة خبرة</span>
                        </div>
                      </div>
                      <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-sm">←</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* التقييمات */}
            {facility.reviews.length > 0 && (
              <div className="rounded-2xl p-6" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                <h2 className="text-white font-bold mb-5 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full inline-block" style={{background:'#f59e0b'}}></span>
                  تقييمات المرضى
                </h2>

                {/* ملخص */}
                <div className="flex flex-col sm:flex-row gap-6 mb-6 p-5 rounded-2xl"
                  style={{background:'rgba(245,158,11,0.05)',border:'1px solid rgba(245,158,11,0.1)'}}>
                  <div className="text-center">
                    <p className="text-5xl font-bold mb-1" style={{color:'#fbbf24'}}>{rating.toFixed(1)}</p>
                    <div className="flex justify-center mb-1">
                      {[1,2,3,4,5].map((s: any) => <span key={s}>{STAR(s <= Math.round(rating))}</span>)}
                    </div>
                    <p className="text-slate-400 text-xs">{facility.totalReviews} تقييم</p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {ratingDist.map((d: any) => (
                      <div key={d.star} className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs w-4">{d.star}</span>
                        <span className="text-amber-400 text-xs">★</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.08)'}}>
                          <div className="h-full rounded-full" style={{width:`${d.pct}%`,background:'#fbbf24'}} />
                        </div>
                        <span className="text-slate-500 text-xs w-6">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {facility.reviews.map((r: any) => (
                    <div key={r.id} className="pb-4 border-b last:border-0" style={{borderColor:'rgba(255,255,255,0.06)'}}>
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{background:`${typeInfo.color}20`,color:typeInfo.color}}>
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
                          {r.comment && <p className="text-slate-300 text-sm mt-1">{r.comment}</p>}
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

          {/* ═══ العمود الجانبي ═══ */}
          <div className="lg:col-span-1 space-y-4">

            {/* بطاقة الحجز */}
            <div className="rounded-2xl overflow-hidden"
              style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
              <div className="p-5 border-b" style={{borderColor:'rgba(255,255,255,0.07)',background:`${typeInfo.color}10`}}>
                <h3 className="text-white font-bold text-lg">حجز موعد</h3>
                <p className="text-slate-400 text-sm mt-0.5">{facility.name}</p>
              </div>
              <div className="p-5">
                <AppointmentForm facilityId={facility.id} />
              </div>
            </div>

            {/* بطاقة المعلومات */}
            <div className="rounded-2xl p-5" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
              <h3 className="text-white font-semibold mb-3 text-sm">معلومات المنشأة</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-base flex-shrink-0 mt-0.5">📍</span>
                  <p className="text-slate-300 text-sm">{facility.address}، {facility.city}</p>
                </div>
                {facility.phone && (
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📞</span>
                    <a href={`tel:${facility.phone}`} className="text-sm hover:text-white transition-colors"
                      style={{color:'#60a5fa'}} dir="ltr">{facility.phone}</a>
                  </div>
                )}
                {facility.email && (
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">✉️</span>
                    <a href={`mailto:${facility.email}`} className="text-sm hover:text-white transition-colors"
                      style={{color:'#60a5fa'}}>{facility.email}</a>
                  </div>
                )}
                {facility.website && (
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🌐</span>
                    <a href={facility.website} target="_blank" rel="noreferrer"
                      className="text-sm hover:text-white transition-colors" style={{color:'#60a5fa'}}>
                      {facility.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <span className="text-base">🪪</span>
                  <span className="text-slate-400 text-xs">رقم الترخيص: {facility.licenseNumber}</span>
                </div>
              </div>
            </div>

            {/* إحصائيات */}
            <div className="rounded-2xl p-5" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
              <h3 className="text-white font-semibold mb-3 text-sm">إحصائيات</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'عدد الأطباء',  value: facility.doctors.length,   icon: '👨‍⚕️' },
                  { label: 'التقييمات',    value: facility.totalReviews,      icon: '⭐' },
                ].map((s: any) => (
                  <div key={s.label} className="rounded-xl p-3 text-center"
                    style={{background:'rgba(255,255,255,0.04)'}}>
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
