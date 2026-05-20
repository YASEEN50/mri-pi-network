'use client'
// src/app/admin/verification/[id]/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'

export default function VerificationDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id     = params.id as string

  const [data,      setData]      = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notes,     setNotes]     = useState('')
  const [submitting,setSubmitting]= useState(false)
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState('')

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/verification/${id}`)
      const d   = await res.json()
      setData(d.data)
    } catch {}
    finally { setIsLoading(false) }
  }, [id])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && !['ADMIN', 'OWNER'].includes(session.user.role)) { router.push('/unauthorized'); return }
    void fetchDetail()
  }, [session, status, router, fetchDetail])

  async function handleDecision(decision: 'APPROVE' | 'REJECT') {
    if (decision === 'REJECT' && !notes.trim()) {
      setError('يرجى كتابة سبب الرفض')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/admin/review', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ verificationId: id, decision, notes }),
      })
      const d = await res.json()
      if (d.data?.error) { setError(d.data.message); return }
      setDone(true)
    } catch {
      setError('حدث خطأ في الاتصال')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  if (done) return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-white mb-2">تم اتخاذ القرار بنجاح</h1>
        <Link href="/admin/verification"
          className="mt-6 inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-medium transition-all">
          ← العودة للقائمة
        </Link>
      </div>
    </div>
  )

  const cert = data?.certificates?.[0]

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/verification" className="text-slate-400 hover:text-white transition-colors text-sm">
            ← رجوع
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">مراجعة طلب التحقق</h1>
            <p className="text-slate-400 text-sm">{data?.doctor?.firstName} {data?.doctor?.lastName}</p>
          </div>
          <div className="mr-auto">
            <span className={`px-3 py-1.5 rounded-full text-sm border font-medium
              ${data?.verificationStatus === 'AI_APPROVED' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                data?.verificationStatus === 'VERIFIED'    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
              {data?.verificationStatus}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* عمود معلومات الطبيب */}
          <div className="space-y-4">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4">معلومات الطبيب</h3>
              <div className="space-y-2 text-sm">
                {[
                  ['الاسم',     `${data?.doctor?.firstName} ${data?.doctor?.lastName}`],
                  ['التخصص',    data?.doctor?.specialization],
                  ['الرخصة',    data?.doctor?.licenseNumber],
                  ['المدينة',   data?.doctor?.city],
                  ['البريد',    data?.doctor?.email],
                ].map(([label, value]) => value && (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-slate-400">{label}</span>
                    <span className="text-white text-left">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* نتائج التحقق */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4">نتائج التحقق</h3>
              <div className="space-y-3">
                <ConfidenceRow label="درجة الثقة الكلية" value={data?.overallConfidence} weight="—" />
                <ConfidenceRow label="تطابق الوجه (40%)"  value={data?.faceMatchConfidence} threshold={80} />
                <ConfidenceRow label="ثقة الشهادة (40%)"  value={cert?.aiConfidence}        threshold={75} />
                <ConfidenceRow label="تطابق الاسم (20%)"  value={cert?.nameMatchScore}       threshold={85} />
              </div>
            </div>
          </div>

          {/* عمود الصور */}
          <div className="space-y-4">
            {/* صور الوجه */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4">صور التحقق من الوجه</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-400 text-xs mb-2">السيلفي</p>
                  {data?.selfieImageUrl
                    ? (
                      <Image
                        src={data.selfieImageUrl}
                        alt="selfie"
                        width={400}
                        height={400}
                        unoptimized
                        className="w-full aspect-square object-cover rounded-xl"
                      />
                    )
                    : <div className="w-full aspect-square bg-white/5 rounded-xl flex items-center justify-center text-slate-500 text-xs">لا يوجد</div>
                  }
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-2">الهوية</p>
                  {data?.idImageUrl
                    ? (
                      <Image
                        src={data.idImageUrl}
                        alt="id"
                        width={400}
                        height={400}
                        unoptimized
                        className="w-full aspect-square object-cover rounded-xl"
                      />
                    )
                    : <div className="w-full aspect-square bg-white/5 rounded-xl flex items-center justify-center text-slate-500 text-xs">لا يوجد</div>
                  }
                </div>
              </div>
              <div className={`mt-3 text-center text-sm py-2 rounded-lg
                ${data?.faceMatchStatus === 'MATCHED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {data?.faceMatchStatus === 'MATCHED' ? `✅ مطابق (${data?.faceMatchConfidence}%)` : `⚠️ غير مطابق`}
              </div>
            </div>

            {/* صورة الشهادة */}
            {cert?.imageUrl && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-3">صورة الشهادة</h3>
                <Image
                  src={cert.imageUrl}
                  alt="certificate"
                  width={800}
                  height={600}
                  unoptimized
                  className="w-full rounded-xl"
                />
              </div>
            )}
          </div>

          {/* عمود البيانات المستخرجة + القرار */}
          <div className="space-y-4">
            {/* بيانات الشهادة */}
            {cert && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">بيانات الشهادة المستخرجة</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ['الاسم المستخرج',  cert.extractedName],
                    ['التخصص',          cert.extractedSpecialty],
                    ['تاريخ الإصدار',   cert.extractedIssueDate],
                    ['تاريخ الانتهاء',  cert.extractedExpiryDate],
                    ['الجهة المانحة',   cert.extractedIssuer],
                  ].map(([label, value]) => value && (
                    <div key={label as string} className="flex justify-between gap-2">
                      <span className="text-slate-400 shrink-0">{label}</span>
                      <span className="text-white text-left text-xs">{value}</span>
                    </div>
                  ))}
                  {cert.aiNotes && (
                    <div className="mt-2 p-2 bg-amber-500/10 rounded-lg">
                      <p className="text-amber-400 text-xs">{cert.aiNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* قرار المشرف */}
            {data?.verificationStatus !== 'VERIFIED' && data?.verificationStatus !== 'REJECTED' && (
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">قرار المشرف</h3>
                <div className="mb-4">
                  <label className="block text-slate-300 text-sm mb-2">ملاحظات (مطلوبة عند الرفض)</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="أضف ملاحظاتك هنا..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none"
                  />
                </div>

                {error && (
                  <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => handleDecision('APPROVE')} disabled={submitting}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all">
                    ✅ قبول
                  </button>
                  <button onClick={() => handleDecision('REJECT')} disabled={submitting}
                    className="flex-1 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-semibold rounded-xl text-sm transition-all">
                    ❌ رفض
                  </button>
                </div>
              </div>
            )}

            {/* نتيجة مكتملة */}
            {(data?.verificationStatus === 'VERIFIED' || data?.verificationStatus === 'REJECTED') && (
              <div className={`p-5 rounded-2xl border text-center
                ${data.verificationStatus === 'VERIFIED' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <p className={`text-lg font-bold ${data.verificationStatus === 'VERIFIED' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {data.verificationStatus === 'VERIFIED' ? '✅ تم القبول' : '❌ تم الرفض'}
                </p>
                {data.rejectionReason && (
                  <p className="text-slate-400 text-sm mt-2">{data.rejectionReason}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfidenceRow({ label, value, threshold, weight }: {
  label: string; value: number | null; threshold?: number; weight?: string
}) {
  const pct   = value ?? 0
  const pass  = threshold ? pct >= threshold : null
  const color = pass === null ? '#64748b' : pass ? '#10b981' : '#f59e0b'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span style={{ color }}>{value !== null ? `${value}%` : '--'}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
