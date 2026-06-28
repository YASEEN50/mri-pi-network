'use client'
// src/app/admin/verification-v2/[id]/page.tsx
// صفحة مراجعة طلب التحقق الواحد — v2

import { useState, useEffect, useCallback } from 'react'
import { useSession }  from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'
import DashboardBreadcrumb from '@/components/admin/DashboardBreadcrumb'
import AdminDocumentModal from '@/components/admin/AdminDocumentModal'

const RISK_COLORS: Record<string, string> = {
  HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#10b981',
}
const DOC_LABELS: Record<string, string> = {
  CREDENTIAL:  '🎓 الشهادة الجامعية',
  LICENSE:     '📋 شهادة مزاولة المهنة',
  DATAFLOW:    '📊 نتيجة Dataflow',
  ID_DOCUMENT: '🪪 الهوية',
  SELFIE:      '🤳 صورة سيلفي',
}
const DEGREE_LABELS: Record<string, string> = {
  BACHELOR: 'بكالوريوس', MASTER: 'ماجستير', FELLOWSHIP: 'زمالة',
}

export default function VerificationDetailPage() {
  const { data: authSession, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string

  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notes,   setNotes]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result,  setResult]  = useState<{type:'success'|'error', msg:string} | null>(null)
  const [preview, setPreview] = useState<{ url: string; mimeType?: string; label: string } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/review-v2?sessionId=${sessionId}`)
      const d   = await res.json()
      setData(d.data)
    } catch {}
    finally { setLoading(false) }
  }, [sessionId])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') {
      const role = (authSession?.user as any)?.role
      if (role !== 'ADMIN' && role !== 'OWNER') { router.push('/unauthorized'); return }
      void loadData()
    }
  }, [status, authSession, router, loadData])

  async function decide(decision: 'APPROVE' | 'REJECT') {
    if (decision === 'REJECT' && !notes.trim()) {
      setResult({ type: 'error', msg: 'يجب كتابة سبب الرفض' }); return
    }
    setSubmitting(true); setResult(null)
    try {
      const res  = await fetch('/api/admin/review-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, decision, notes: notes.trim() || undefined }),
      })
      const d = await res.json()
      if (d.data?.error || d.error) {
        setResult({ type: 'error', msg: d.data?.message ?? d.error?.message ?? 'حدث خطأ' })
      } else {
        setResult({ type: 'success', msg: d.data?.message ?? 'تم تنفيذ القرار بنجاح' })
        setTimeout(() => router.push('/admin/verification-v2'), 2000)
      }
    } catch { setResult({ type: 'error', msg: 'خطأ في الاتصال' }) }
    finally { setSubmitting(false) }
  }

  if (status === 'loading' || loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  )

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="text-4xl mb-3">😕</div>
        <p className="text-slate-400">الجلسة غير موجودة</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-400 text-sm">← رجوع</button>
      </div>
    </div>
  )

  const canDecide = data.currentState === 'PENDING_HUMAN' || data.currentState === 'ADMIN_REVIEW'

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <DashboardBreadcrumb
          items={[
            { label: 'التحقق المتقدم (v2)', href: '/admin/verification-v2' },
            { label: data.doctor?.name ?? 'مراجعة الطلب' },
          ]}
        />
        <div className="flex items-center gap-3 mt-4">
          <h1 className="text-xl font-bold text-white">مراجعة طلب التحقق</h1>
          <span className="text-slate-500 text-sm font-mono">{sessionId.slice(0, 8)}...</span>
        </div>

        {/* Doctor Info */}
        <div className="rounded-2xl p-5" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
          <h2 className="text-white font-semibold mb-4">👨‍⚕️ بيانات الطبيب</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['الاسم',         data.doctor?.name],
              ['التخصص',       data.doctor?.specialization],
              ['رقم الرخصة',   data.doctor?.licenseNumber],
              ['المدينة',      data.doctor?.city],
              ['البريد',       data.doctor?.email],
              ['تاريخ التسجيل', data.doctor?.memberSince ? new Date(data.doctor.memberSince).toLocaleDateString('ar-SA') : '-'],
            ].map(([label, value]) => (
              <div key={label as string}>
                <span className="text-slate-500">{label}: </span>
                {label === 'الاسم' && data.doctor?.id ? (
                  <Link href={`/admin/doctors/${data.doctor.id}/verify`}
                    className="text-accent hover:underline">
                    {value ?? '-'}
                  </Link>
                ) : (
                  <span className="text-slate-200">{value ?? '-'}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Score */}
        {data.score && (
          <div className="rounded-2xl p-5" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
            <h2 className="text-white font-semibold mb-4">📊 درجة المخاطرة</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center"
                style={{background:`${RISK_COLORS[data.score.riskLevel]}15`,border:`2px solid ${RISK_COLORS[data.score.riskLevel]}40`}}>
                <span className="text-2xl font-bold" style={{color:RISK_COLORS[data.score.riskLevel]}}>
                  {data.score.finalScore}
                </span>
                <span className="text-xs" style={{color:RISK_COLORS[data.score.riskLevel]}}>
                  {data.score.riskLevel === 'HIGH' ? 'عالي' : data.score.riskLevel === 'MEDIUM' ? 'متوسط' : 'منخفض'}
                </span>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                {[
                  ['OCR', data.score.ocrConfidence],
                  ['الوجه', data.score.faceMatchScore],
                  ['الاحتيال', data.score.fraudRiskScore],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex justify-between items-center">
                    <span className="text-slate-400">{label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{width:`${val}%`}} />
                      </div>
                      <span className="text-slate-300 text-xs w-8 text-left">{val}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Face Verification */}
        {data.faceVerification && (
          <div className="rounded-2xl p-5" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
            <h2 className="text-white font-semibold mb-3">🪪 نتيجة مقارنة الوجه</h2>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl p-3 text-center" style={{background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.15)'}}>
                <div className="text-2xl font-bold text-blue-400">{data.faceVerification.matchScore}%</div>
                <div className="text-slate-400 text-xs mt-1">درجة التطابق</div>
              </div>
              <div className="rounded-xl p-3 text-center" style={{background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.15)'}}>
                <div className="text-lg font-bold text-indigo-400">{data.faceVerification.confidence}</div>
                <div className="text-slate-400 text-xs mt-1">مستوى الثقة</div>
              </div>
              <div className="rounded-xl p-3 text-center" style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.15)'}}>
                <div className="text-lg font-bold" style={{color: data.faceVerification.facesDetected ? '#10b981' : '#ef4444'}}>
                  {data.faceVerification.facesDetected ? '✅ تم' : '❌ فشل'}
                </div>
                <div className="text-slate-400 text-xs mt-1">اكتشاف الوجه</div>
              </div>
            </div>
            <p className="text-slate-500 text-xs mt-2">الخدمة: {data.faceVerification.serviceUsed}</p>
          </div>
        )}

        {/* Fraud Flags */}
        {data.fraudFlags?.length > 0 && (
          <div className="rounded-2xl p-5" style={{background:'rgba(239,68,68,0.04)',border:'1px solid rgba(239,68,68,0.15)'}}>
            <h2 className="text-red-400 font-semibold mb-3">⚠️ علامات الاحتيال ({data.fraudFlags.length})</h2>
            <div className="space-y-2">
              {data.fraudFlags.map((f: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-red-400 mt-0.5">•</span>
                  <div>
                    <span className="text-red-300 font-medium">{f.type}</span>
                    <span className="text-slate-400 mr-2">— تشابه {f.similarity}%</span>
                    <div className="text-slate-500 text-xs mt-0.5">{(f.flags as string[]).join(' · ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents */}
        <div className="rounded-2xl p-5" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
          <h2 className="text-white font-semibold mb-3">📁 الوثائق المرفوعة ({data.documents?.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.documents?.map((doc: any) => (
              <div key={doc.id} className="rounded-xl p-3 flex items-center justify-between gap-2"
                style={{
                  background: doc.isFlagged ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${doc.isFlagged ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`,
                }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{DOC_LABELS[doc.docType]?.split(' ')[0] ?? '📄'}</span>
                  <div className="min-w-0">
                    <p className="text-slate-200 text-sm">{DOC_LABELS[doc.docType]?.split(' ').slice(1).join(' ') ?? doc.docType}</p>
                    {(doc.subType || doc.legalName) && (
                      <p className="text-slate-500 text-xs mt-0.5 truncate">
                        {doc.subType ? DEGREE_LABELS[doc.subType] ?? doc.subType : ''}
                        {doc.subType && doc.legalName ? ' · ' : ''}
                        {doc.legalName ?? ''}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs ${doc.isProcessed ? 'text-accent' : 'text-amber-400'}`}>
                        {doc.isProcessed ? '✅ معالج' : '⏳ معالجة'}
                      </span>
                      <span className="text-slate-600 text-xs">{doc.sizeKb} KB</span>
                    </div>
                    {doc.isFlagged && <p className="text-red-400 text-xs mt-0.5">{doc.flagReason}</p>}
                  </div>
                </div>
                {doc.url && (
                  <button
                    type="button"
                    onClick={() => setPreview({
                      url: doc.url,
                      mimeType: doc.mimeType,
                      label: DOC_LABELS[doc.docType] ?? doc.docType,
                    })}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs text-blue-400 border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20">
                    عرض
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Decision Panel */}
        {canDecide && (
          <div className="rounded-2xl p-5" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
            <h2 className="text-white font-semibold mb-4">⚖️ القرار النهائي</h2>

            <div className="mb-4">
              <label className="text-sm text-slate-300 mb-2 block">ملاحظات (مطلوبة عند الرفض)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows={3} placeholder="اكتب ملاحظاتك هنا..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 resize-none" />
            </div>

            {result && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: result.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${result.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  color: result.type === 'success' ? '#34d399' : '#f87171',
                }}>
                {result.msg}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => decide('APPROVE')} disabled={submitting}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50 transition-all"
                style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>
                {submitting ? '...' : '✅ قبول الطبيب'}
              </button>
              <button onClick={() => decide('REJECT')} disabled={submitting}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50 transition-all"
                style={{background:'linear-gradient(135deg,#ef4444,#dc2626)'}}>
                {submitting ? '...' : '❌ رفض الطلب'}
              </button>
            </div>
          </div>
        )}

        {/* Already decided */}
        {!canDecide && (
          <div className="rounded-2xl p-5 text-center"
            style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)'}}>
            <p className="text-slate-400">
              {data.currentState === 'APPROVED' ? '✅ تم قبول هذا الطلب' :
               data.currentState === 'REJECTED' ? '❌ تم رفض هذا الطلب' :
               `الحالة الحالية: ${data.currentState}`}
            </p>
            {data.rejectionReason && (
              <p className="text-slate-500 text-sm mt-2">سبب الرفض: {data.rejectionReason}</p>
            )}
          </div>
        )}

      </div>

      <AdminDocumentModal
        open={!!preview}
        url={preview?.url ?? ''}
        mimeType={preview?.mimeType}
        label={preview?.label ?? 'وثيقة'}
        onClose={() => setPreview(null)}
      />
    </div>
  )
}
