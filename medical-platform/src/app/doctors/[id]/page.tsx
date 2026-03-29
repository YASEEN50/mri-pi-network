// src/app/doctors/[id]/page.tsx
import { getLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Navbar from '@/components/common/Navbar'
import AppointmentForm from '@/components/appointments/AppointmentForm'
import { prisma } from '@/infrastructure/database/prisma/client'

export default async function DoctorDetailPage({ params }: { params: { id: string } }) {
  const locale = await getLocale() as 'ar' | 'en'

  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      credentials: { where: { deletedAt: null } },
      reviews: {
        where: { isVisible: true, deletedAt: null },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { client: { include: { clientProfile: { select: { firstName: true, lastName: true } } } } },
      },
    },
  })

  if (!doctor) notFound()

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar locale={locale} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left: Doctor Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
              <div className="flex items-start gap-5">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center text-3xl font-bold text-emerald-400 flex-shrink-0">
                  {doctor.firstName[0]}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{doctor.firstName} {doctor.lastName}</h1>
                  <p className="text-emerald-400 mt-1">{doctor.specialization}</p>
                  {doctor.subSpecialization && <p className="text-slate-400 text-sm">{doctor.subSpecialization}</p>}
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-white font-semibold">{Number(doctor.averageRating).toFixed(1)}</span>
                      <span className="text-slate-500 text-sm">({doctor.totalReviews})</span>
                    </div>
                    <span className="text-slate-500 text-sm">{doctor.yearsOfExperience} {locale === 'ar' ? 'سنة خبرة' : 'yrs exp'}</span>
                    {doctor.city && <span className="text-slate-500 text-sm">📍 {doctor.city}</span>}
                  </div>
                </div>
              </div>
              {doctor.bio && <p className="text-slate-300 text-sm mt-5 leading-relaxed">{doctor.bio}</p>}
            </div>

            {/* Credentials */}
            {doctor.credentials.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-4">
                  {locale === 'ar' ? 'المؤهلات العلمية' : 'Credentials'}
                </h2>
                <div className="space-y-3">
                  {doctor.credentials.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs font-bold flex-shrink-0">
                        🎓
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{c.title}</p>
                        <p className="text-xs text-slate-400">{c.institution} · {c.year}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            {doctor.reviews.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-4">
                  {locale === 'ar' ? 'تقييمات المرضى' : 'Patient Reviews'}
                </h2>
                <div className="space-y-4">
                  {doctor.reviews.map((r) => (
                    <div key={r.id} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[1,2,3,4,5].map((s) => (
                            <svg key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? 'text-amber-400' : 'text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-slate-400 text-xs">
                          {r.client.clientProfile
                            ? `${r.client.clientProfile.firstName} ${r.client.clientProfile.lastName}`
                            : locale === 'ar' ? 'مستخدم' : 'User'}
                        </span>
                      </div>
                      {r.comment && <p className="text-slate-300 text-sm">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Booking */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-white">{locale === 'ar' ? 'حجز موعد' : 'Book Appointment'}</h3>
                {doctor.consultationFee && (
                  <span className="text-emerald-400 font-bold">{Number(doctor.consultationFee)} {locale === 'ar' ? 'ر.س' : 'SAR'}</span>
                )}
              </div>
              <AppointmentForm doctorId={doctor.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
