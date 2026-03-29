'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'

interface FacilityDoctor {
  doctorId: string
  role?: string
  isActive: boolean
  doctor: { firstName: string; lastName: string; specialization: string; averageRating: number }
}

export default function FacilityDoctorsPage() {
  const [doctors, setDoctors] = useState<FacilityDoctor[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/facility/doctors').then((r) => r.json()).then((d) => { setDoctors(d.data ?? []) }).catch(() => {}).finally(() => setIsLoading(false))
  }, [])

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" /></div>

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar locale="ar" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">الأطباء التابعون</h1>
            <p className="text-slate-400 text-sm mt-1">{doctors.length} طبيب مرتبط بمنشأتك</p>
          </div>
          <Link href="/doctors" className="px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-400 rounded-xl text-sm font-medium transition-all">+ إضافة طبيب</Link>
        </div>
        {doctors.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">👨‍⚕️</div>
            <p className="text-slate-400 mb-4">لا يوجد أطباء مرتبطون بمنشأتك بعد</p>
            <Link href="/doctors" className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-medium transition-all">استعرض الأطباء</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {doctors.map((d) => (
              <div key={d.doctorId} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-lg flex-shrink-0">{d.doctor.firstName[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{d.doctor.firstName} {d.doctor.lastName}</p>
                  <p className="text-emerald-400 text-sm">{d.doctor.specialization}</p>
                  {d.role && <p className="text-slate-500 text-xs mt-0.5">{d.role}</p>}
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full border ${d.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                  {d.isActive ? 'نشط' : 'غير نشط'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
