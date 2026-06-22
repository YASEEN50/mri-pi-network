'use client'
// src/app/admin/doctors/[id]/verify/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'
import DashboardBreadcrumb from '@/components/admin/DashboardBreadcrumb'

interface DoctorDetail {
  id: string
  fullName: string
  specialization: string
  subSpecialization?: string
  licenseNumber: string
  licenseExpiryDate?: string
  yearsOfExperience: number
  languages: string[]
  city?: string
  country: string
  bio?: string
  approvalStatus: string
  approvalNotes?: string
}

interface DoctorDocuments {
  license: { url: string | null; mimeType: string | null } | null
  credentials: Array<{
    id: string
    title: string
    institution: string
    country: string
    year: number
    documentUrl: string | null
    mimeType: string | null
  }>
  otherDocuments: Array<{ docType: string; url: string; mimeType: string }>
}

function DocumentPreview({ url, mimeType, label }: { url: string; mimeType?: string | null; label: string }) {
  const isPdf = mimeType === 'application/pdf' || url.toLowerCase().includes('.pdf')
  if (isPdf) {
    return (
      <iframe src={url} title={label} className="w-full h-96 rounded-xl border border-white/10 bg-white" />
    )
  }
  return (
    <img src={url} alt={label} className="w-full max-h-96 object-contain rounded-xl border border-white/10 bg-black/20" />
  )
}

export default function DoctorVerifyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const doctorId = params.id as string

  const [doctor, setDoctor] = useState<DoctorDetail | null>(null)
  const [documents, setDocuments] = useState<DoctorDocuments | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [rejectNotes, setRejectNotes] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)

  const loadDoctor = useCallback(async () => {
    try {
      const [profileRes, docsRes] = await Promise.all([
        fetch(`/api/doctors/${doctorId}`),
        fetch(`/api/admin/doctors/${doctorId}/documents`),
      ])
      const profile = await profileRes.json()
      const docs = await docsRes.json()
      if (profileRes.ok) {
        setDoctor({
          id: profile.data.id,
          fullName: profile.data.fullName,
          specialization: profile.data.specialization,
          licenseNumber: profile.data.licenseNumber,
          yearsOfExperience: profile.data.yearsOfExperience,
          languages: profile.data.languages ?? [],
          city: profile.data.city,
          country: profile.data.country,
          bio: profile.data.bio,
          approvalStatus: profile.data.approvalStatus,
        })
      }
      if (docsRes.ok) setDocuments(docs.data)
    } catch {}
    finally { setIsLoading(false) }
  }, [doctorId])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && !['ADMIN', 'OWNER'].includes(session.user.role)) { router.push('/'); return }
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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )

  if (done) return (
    <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <div className="text-6xl mb-4">{done === 'approved' ? '✅' : '❌'}</div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {done === 'approved' ? 'تمت الموافقة على الطبيب' : 'تم رفض طلب الطبيب'}
        </h2>
        <Link href="/dashboard/admin/pending"
          className="mt-4 inline-block px-6 py-3 bg-primary hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-all">
          العودة للطلبات المعلقة
        </Link>
      </div>
    </div>
  )

  if (!doctor) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-slate-400">الطبيب غير موجود</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">

        {/* Header */}
        <div className="mb-6">
          <DashboardBreadcrumb
            items={[
              { label: 'الطلبات المعلقة', href: '/dashboard/admin/pending' },
              { label: 'مراجعة الطبيب' },
            ]}
          />
          <div className="flex items-center justify-between mt-4">
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
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-500 text-xs mb-0.5">رقم الرخصة</p>
                <p className="text-white font-mono font-bold text-lg">{doctor.licenseNumber}</p>
              </div>
              {documents?.license?.url && (
                <a href={documents.license.url} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 rounded-xl text-sm transition-all">
                  فتح في تبويب جديد ↗
                </a>
              )}
            </div>
            {documents?.license?.url ? (
              <DocumentPreview
                url={documents.license.url}
                mimeType={documents.license.mimeType}
                label="رخصة مزاولة المهنة"
              />
            ) : (
              <p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                لم يُرفع ملف رخصة حقيقي بعد — الطبيب يحتاج رفع الرخصة من صفحة التحقق، أو راجع{' '}
                <Link href="/admin/verification-v2" className="underline text-amber-300">التحقق v2</Link>
              </p>
            )}
          </div>

          {/* Credentials */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">
              الشهادات العلمية ({documents?.credentials.length ?? 0})
            </h2>
            {!documents?.credentials.length ? (
              <p className="text-slate-400 text-sm">لا توجد شهادات مرفوعة</p>
            ) : (
              <div className="space-y-4">
                {documents.credentials.map((cred) => (
                  <div key={cred.id} className="p-4 bg-white/[0.02] rounded-xl border border-white/5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white text-sm">{cred.title}</p>
                        <p className="text-slate-400 text-xs mt-0.5">
                          {cred.institution} · {cred.country} · {cred.year}
                        </p>
                      </div>
                      {cred.documentUrl && (
                        <a href={cred.documentUrl} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg text-xs transition-all shrink-0">
                          فتح ↗
                        </a>
                      )}
                    </div>
                    {cred.documentUrl ? (
                      <DocumentPreview url={cred.documentUrl} mimeType={cred.mimeType} label={cred.title} />
                    ) : (
                      <p className="text-slate-500 text-xs">لا يوجد ملف مرفق — رابط placeholder فقط</p>
                    )}
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
                  className="flex-1 py-3 bg-gradient-to-r from-primary to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-glow-primary">
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
