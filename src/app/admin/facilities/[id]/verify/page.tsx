'use client'
// src/app/admin/facilities/[id]/verify/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'
import DashboardBreadcrumb from '@/components/admin/DashboardBreadcrumb'

const TYPE_LABELS: Record<string, string> = {
  CLINIC: 'عيادة', HOSPITAL: 'مستشفى', MEDICAL_CENTER: 'مركز طبي',
  LABORATORY: 'مختبر', PHARMACY: 'صيدلية', SCIENTIFIC_INSTITUTE: 'معهد علمي',
  UNIVERSITY: 'جامعة', MEDICAL_COLLEGE: 'كلية طب',
}

interface FacilityDetail {
  id: string
  name: string
  type: string
  licenseNumber: string
  city: string
  address: string
  phone?: string
  email?: string
  description?: string
  approvalStatus: string
}

interface FacilityDocuments {
  ownership: { url: string; mimeType: string | null } | null
  license: { url: string; mimeType: string | null } | null
}

function DocumentPreview({ url, mimeType, label }: { url: string; mimeType?: string | null; label: string }) {
  const isPdf = mimeType === 'application/pdf' || url.toLowerCase().includes('.pdf')
  if (isPdf) {
    return <iframe src={url} title={label} className="w-full h-96 rounded-xl border border-white/10 bg-white" />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={label}
      className="w-full max-h-96 object-contain rounded-xl border border-white/10 bg-black/20"
    />
  )
}

export default function FacilityVerifyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const facilityId = params.id as string

  const [facility, setFacility] = useState<FacilityDetail | null>(null)
  const [documents, setDocuments] = useState<FacilityDocuments | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [rejectNotes, setRejectNotes] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)

  const loadData = useCallback(async () => {
    setLoadError('')
    try {
      const res = await fetch(`/api/admin/facilities/${facilityId}/documents`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data.data) {
        setFacility(data.data.facility)
        setDocuments(data.data.documents)
        return
      }
      setLoadError(
        data?.error?.message ??
          (res.status === 401 ? 'يجب تسجيل الدخول كأدمن' : 'تعذّر تحميل المستندات'),
      )
    } catch {
      setLoadError('خطأ في الاتصال — أعد تحميل الصفحة')
    } finally { setIsLoading(false) }
  }, [facilityId])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && !['ADMIN', 'OWNER'].includes(session.user.role)) { router.push('/'); return }
    if (session) void loadData()
  }, [session, status, router, loadData])

  async function handleApprove() {
    setIsSubmitting(true)
    const res = await fetch(`/api/admin/facilities/${facilityId}/approve`, {
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
    const res = await fetch(`/api/admin/facilities/${facilityId}/approve`, {
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
          {done === 'approved' ? 'تمت الموافقة على المنشأة' : 'تم رفض طلب المنشأة'}
        </h2>
        <Link href="/dashboard/admin/pending"
          className="mt-4 inline-block px-6 py-3 bg-primary hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-all">
          العودة للطلبات المعلقة
        </Link>
      </div>
    </div>
  )

  if (!facility) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-slate-400">المنشأة غير موجودة</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-6">
          <DashboardBreadcrumb
            items={[
              { label: 'الطلبات المعلقة', href: '/dashboard/admin/pending' },
              { label: 'مراجعة المنشأة' },
            ]}
          />
          <div className="flex items-center justify-between mt-4">
            <div>
              <h1 className="text-2xl font-bold text-white">مراجعة منشأة: {facility.name}</h1>
              {facility.email && (
                <p className="text-slate-500 text-xs mt-1">📧 {facility.email}</p>
              )}
            </div>
            <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-sm">
              قيد المراجعة
            </span>
          </div>
        </div>

        {loadError && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {loadError}
          </div>
        )}

        <div className="space-y-5">
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">بيانات المنشأة</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'الاسم', value: facility.name },
                { label: 'النوع', value: TYPE_LABELS[facility.type] ?? facility.type },
                { label: 'رقم الترخيص', value: facility.licenseNumber },
                { label: 'المدينة', value: facility.city },
                { label: 'العنوان', value: facility.address },
                { label: 'الهاتف', value: facility.phone ?? '—' },
                { label: 'البريد', value: facility.email ?? '—' },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-slate-500 text-xs mb-0.5">{item.label}</p>
                  <p className="text-white font-medium">{item.value}</p>
                </div>
              ))}
            </div>
            {facility.description && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-slate-500 text-xs mb-1">الوصف</p>
                <p className="text-slate-300 text-sm">{facility.description}</p>
              </div>
            )}
          </div>

          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">🏠 أوراق الملكية / عقد الإيجار</h2>
              {documents?.ownership?.url && (
                <a href={documents.ownership.url} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl text-sm">
                  فتح ↗
                </a>
              )}
            </div>
            {documents?.ownership?.url ? (
              <DocumentPreview url={documents.ownership.url} mimeType={documents.ownership.mimeType} label="أوراق الملكية" />
            ) : (
              <p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                لم تُرفع أوراق الملكية بعد
              </p>
            )}
          </div>

          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">📋 التصريح / الترخيص الرسمي</h2>
              {documents?.license?.url && (
                <a href={documents.license.url} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl text-sm">
                  فتح ↗
                </a>
              )}
            </div>
            {documents?.license?.url ? (
              <DocumentPreview url={documents.license.url} mimeType={documents.license.mimeType} label="التصريح الرسمي" />
            ) : (
              <p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                لم يُرفع التصريح الرسمي بعد
              </p>
            )}
          </div>

          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">⚖️ القرار</h2>
            {!showRejectForm ? (
              <div className="flex gap-3">
                <button onClick={handleApprove} disabled={isSubmitting}
                  className="flex-1 py-3 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-accent rounded-xl font-medium disabled:opacity-50">
                  ✅ قبول المنشأة
                </button>
                <button onClick={() => setShowRejectForm(true)} disabled={isSubmitting}
                  className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl font-medium">
                  ❌ رفض
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)}
                  placeholder="سبب الرفض (10 أحرف على الأقل)..." rows={3}
                  className="w-full bg-white/5 border border-red-500/20 rounded-xl px-4 py-3 text-white text-sm resize-none focus:outline-none" />
                <div className="flex gap-3">
                  <button onClick={handleReject} disabled={isSubmitting || rejectNotes.length < 10}
                    className="px-6 py-2.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm disabled:opacity-50">
                    تأكيد الرفض
                  </button>
                  <button onClick={() => setShowRejectForm(false)}
                    className="px-6 py-2.5 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-sm">
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
