import { getLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Navbar from '@/components/common/Navbar'
import AppointmentForm from '@/components/appointments/AppointmentForm'
import { prisma } from '@/infrastructure/database/prisma/client'

export default async function FacilityDetailPage({ params }: { params: { id: string } }) {
  const locale = await getLocale() as 'ar' | 'en'
  const facility = await prisma.facilityProfile.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      doctors: { where: { isActive: true }, include: { doctor: { select: { firstName: true, lastName: true, specialization: true, averageRating: true } } }, take: 6 },
      reviews: { where: { isVisible: true, deletedAt: null }, take: 5, orderBy: { createdAt: 'desc' }, include: { client: { include: { clientProfile: { select: { firstName: true, lastName: true } } } } } },
    },
  })
  if (!facility) notFound()
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar locale={locale} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
              <div className="flex items-start gap-5">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-400/20 to-blue-500/20 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-10 h-10 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{facility.name}</h1>
                  <span className="inline-block mt-1 px-3 py-1 text-xs bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full">{facility.type}</span>
                  <p className="text-slate-400 text-sm mt-2">📍 {facility.address}, {facility.city}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      <span className="text-white font-semibold">{Number(facility.averageRating).toFixed(1)}</span>
                      <span className="text-slate-500 text-sm">({facility.totalReviews})</span>
                    </div>
                    {facility.phone && <span className="text-slate-400 text-sm">📞 {facility.phone}</span>}
                  </div>
                </div>
              </div>
              {facility.description && <p className="text-slate-300 text-sm mt-5 leading-relaxed">{facility.description}</p>}
            </div>
            {facility.doctors.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-4">{locale === 'ar' ? 'الأطباء التابعون' : 'Our Doctors'}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {facility.doctors.map((df) => (
                    <div key={df.doctorId} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold flex-shrink-0">{df.doctor.firstName[0]}</div>
                      <div>
                        <p className="text-sm font-medium text-white">{df.doctor.firstName} {df.doctor.lastName}</p>
                        <p className="text-xs text-slate-400">{df.doctor.specialization}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="lg:col-span-1">
            <div className="sticky top-20 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
              <h3 className="font-bold text-white mb-5">{locale === 'ar' ? 'حجز موعد' : 'Book Appointment'}</h3>
              <AppointmentForm facilityId={facility.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
