'use client'
// src/app/admin/doctors/[id]/verify/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'

interface DoctorDetail {
  id: string
  fullName: string
  specialization: string
  subSpecialization?: string
  licenseNumber: string
  licenseImageUrl: string
  licenseExpiryDate?: string
  yearsOfExperience: number
  languages: string[]
  city?: string
  country: string
  bio?: string
  approvalStatus: string
  approvalNotes?: string
  credentials: Array<{
    id: string
    title: string
    institution: string
    country: string
    year: number
    documentUrl: string
    isVerified: boolean
  }>
}

export default function DoctorVerifyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const doctorId = params.id as string

  const [doctor, setDoctor] = useState<DoctorDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [rejectNotes, setRejectNotes] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)

  const loadDoctor = useCallback(async () => {
    try {
      const res = await fetch(`/api/doctors/${doctorId}`)
      const data = await res.json()
      if (res.ok) setDoctor(data.data)
    } catch {}
    finally { setIsLoading(false) }
  }, [doctorId])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session?.user?.role !== 'ADMIN') { router.push('/'); return }
    if (session) void loadDoctor()
  }, [session, status, router, loadDoctor])

  async function handleApprove() {
    setIsSubmitting(true)
    const res = await fetch(`/api/admin/doctors/${doctorId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    if (res.ok) setDone('approved')
    setIsSubmitting(false)
  }

  async function handleReject() {
    if (!rejectNotes.trim() || rejectNotes.length < 10) return
    setIsSubmitting(true)
    const res = await fetch(`/api/admin/doctors/${doctorId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', notes: rejectNotes }),
    })
    if (res.ok) setDone('rejected')
    setIsSubmitting(false)
  }

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  if (done) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <div className="text-6xl mb-4">{done === 'approved' ? '✅' : '❌'}</div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {done === 'approved' ? 'تمت الموافقة على الطبيب' : 'تم رفض طلب الطبيب'}
        </h2>
        <Link href="/admin/doctors"
          className="mt-4 inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-medium transition-all">
          العودة للقائمة
        </Link>
      </div>
    </div>
  )

  if (!doctor) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <p className="text-slate-400">الطبيب غير موجود</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">

        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/doctors" className="text-slate-400 hover:text-white text-sm mb-3 inline-block">
            ← العودة لقائمة الأطباء
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">مراجعة ملف الطبيب</h1>
            <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-sm">
              قيد المراجعة
            </span>
          </div>
        </div>

        <div className="space-y-5">
          {/* Basic Info */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">المعلومات الأساسية</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'الاسم الكامل', value: doctor.fullName },
                { label: 'التخصص', value: doctor.specialization },
                { label: 'التخصص الفرعي', value: doctor.subSpecialization ?? '-' },
                { label: 'سنوات الخبرة', value: `${doctor.yearsOfExperience} سنة` },
                { label: 'المدينة', value: doctor.city ?? '-' },
                { label: 'الدولة', value: doctor.country },
                { label: 'اللغات', value: doctor.languages.join(', ') },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-slate-500 text-xs mb-0.5">{item.label}</p>
                  <p className="text-white font-medium">{item.value}</p>
                </div>
              ))}
            </div>
            {doctor.bio && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-slate-500 text-xs mb-1">نبذة</p>
                <p className="text-slate-300 text-sm leading-relaxed">{doctor.bio}</p>
              </div>
            )}
          </div>

          {/* License */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">رخصة مزاولة المهنة</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-xs mb-0.5">رقم الرخصة</p>
                <p className="text-white font-mono font-bold text-lg">{doctor.licenseNumber}</p>
                {doctor.licenseExpiryDate && (
                  <p className="text-slate-400 text-xs mt-1">
                    تنتهي: {new Date(doctor.licenseExpiryDate).toLocaleDateString('ar-SA')}
                  </p>
                )}
              </div>
              <a href={doctor.licenseImageUrl} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 rounded-xl text-sm transition-all">
                عرض صورة الرخصة 📄
              </a>
            </div>
          </div>

          {/* Credentials */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">
              الشهادات العلمية ({doctor.credentials.length})
            </h2>
            {doctor.credentials.length === 0 ? (
              <p className="text-slate-400 text-sm">لا توجد شهادات مرفوعة</p>
            ) : (
              <div className="space-y-3">
                {doctor.credentials.map((cred) => (
                  <div key={cred.id}
                    className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5">
                    <div>
                      <p className="font-medium text-white text-sm">{cred.title}</p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {cred.institution} · {cred.country} · {cred.year}
                      </p>
                    </div>
                    <a href={cred.documentUrl} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg text-xs transition-all">
                      عرض 📄
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">القرار النهائي</h2>

            {!showRejectForm ? (
              <div className="flex gap-3">
                <button onClick={handleApprove} disabled={isSubmitting}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20">
                  {isSubmitting ? 'جاري المعالجة...' : '✓ الموافقة على الطبيب'}
                </button>
                <button onClick={() => setShowRejectForm(true)}
                  className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold rounded-xl transition-all">
                  ✗ رفض الطلب
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  سبب الرفض (مطلوب - 10 أحرف على الأقل)
                </label>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  rows={3}
                  placeholder="اكتب سبب الرفض بوضوح ليتمكن الطبيب من تصحيح طلبه..."
                  className="w-full bg-white/5 border border-red-500/20 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none resize-none"
                />
                <div className="flex gap-3">
                  <button onClick={handleReject} disabled={isSubmitting || rejectNotes.length < 10}
                    className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 disabled:opacity-50 text-red-400 font-bold rounded-xl transition-all">
                    {isSubmitting ? 'جاري الرفض...' : 'تأكيد الرفض'}
                  </button>
                  <button onClick={() => setShowRejectForm(false)}
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl transition-all text-sm">
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
