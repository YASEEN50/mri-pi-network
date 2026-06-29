'use client'
// لوحة المستندات المشبوهة — forensics + تزوير محتمل

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'
import AdminDocumentModal from '@/components/admin/AdminDocumentModal'

const DOC_TYPE_LABELS: Record<string, string> = {
  CREDENTIAL:  '🎓 شهادة جامعية',
  LICENSE:     '📋 رخصة',
  DATAFLOW:    '📊 Dataflow',
  ID_DOCUMENT: '🪪 هوية',
  SELFIE:      '🤳 سيلفي',
}

function scoreColor(score: number): string {
  if (score >= 70) return '#ef4444'
  if (score >= 50) return '#f97316'
  return '#f59e0b'
}

interface SuspiciousDoc {
  id: string
  sessionId: string
  doctorId: string
  docType: string
  docTypeLabel: string
  legalName?: string
  forensicsScore: number
  forensicsSignals: Array<{ code: string; label: string; weight: number }>
  isFlagged: boolean
  flagReason?: string
  url: string
  mimeType: string
  sizeKb: number
  doctorName?: string
  specialization?: string
  sessionState?: string
  createdAt: string
}

export default function SuspiciousDocumentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [docs,    setDocs]    = useState<SuspiciousDoc[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [minScore, setMinScore] = useState(40)
  const [docType,  setDocType]  = useState('')
  const [preview, setPreview] = useState<{ url: string; mimeType?: string; label: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') {
      const role = (session?.user as any)?.role
      if (role !== 'ADMIN' && role !== 'OWNER') { router.push('/unauthorized'); return }
    }
  }, [status, session, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(50),
        minScore: String(minScore),
        ...(docType && { docType }),
      })
      const res  = await fetch(`/api/admin/suspicious-documents?${params}`)
      const data = await res.json()
      setDocs(data.data?.documents ?? [])
      setTotal(data.meta?.total ?? 0)
    } catch {}
    finally { setLoading(false) }
  }, [minScore, docType])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        <div className="flex items-center justify-between mt-2 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">🔬 مستندات مشبوهة</h1>
            <p className="text-slate-500 text-sm mt-1">
              فحص metadata وسلامة الملف — ليس حكماً قانونياً نهائياً
            </p>
          </div>
          <Link href="/admin/verification-v2"
            className="text-sm text-blue-400 hover:underline">
            ← التحقق v2
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300">
            <option value={30}>درجة ≥ 30</option>
            <option value={40}>درجة ≥ 40</option>
            <option value={50}>درجة ≥ 50</option>
            <option value={70}>درجة ≥ 70</option>
          </select>
          <select value={docType} onChange={(e) => setDocType(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300">
            <option value="">كل الأنواع</option>
            {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <span className="text-slate-500 text-sm self-center">{total} مستند</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">✅</div>
            لا توجد مستندات مشبوهة بهذا الفلتر
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => {
              const color = scoreColor(doc.forensicsScore ?? 0)
              return (
                <div key={doc.id} className="rounded-2xl p-4"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}30` }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0"
                        style={{ background: `${color}15`, border: `1px solid ${color}40` }}>
                        <span className="text-lg font-bold" style={{ color }}>{doc.forensicsScore}</span>
                        <span className="text-[10px] text-slate-500">forensics</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium">
                            {DOC_TYPE_LABELS[doc.docType] ?? doc.docTypeLabel}
                          </span>
                          {doc.legalName && (
                            <span className="text-slate-500 text-sm">· {doc.legalName}</span>
                          )}
                        </div>
                        <p className="text-slate-400 text-sm mt-0.5">
                          {doc.doctorName ?? 'طبيب غير معروف'}
                          {doc.specialization && ` · ${doc.specialization}`}
                        </p>
                        <p className="text-slate-600 text-xs mt-1">
                          {new Date(doc.createdAt).toLocaleString('ar-SA')} · {doc.sizeKb} KB · {doc.mimeType}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button type="button"
                        onClick={() => setPreview({ url: doc.url, mimeType: doc.mimeType, label: doc.docTypeLabel })}
                        className="px-3 py-1.5 rounded-lg text-xs text-blue-400 border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20">
                        عرض
                      </button>
                      <Link href={`/admin/verification-v2/${doc.sessionId}`}
                        className="px-3 py-1.5 rounded-lg text-xs text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20">
                        مراجعة
                      </Link>
                    </div>
                  </div>

                  {doc.forensicsSignals?.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {doc.forensicsSignals.map((sig) => (
                        <div key={sig.code} className="flex items-start gap-2 text-xs">
                          <span style={{ color }}>•</span>
                          <span className="text-slate-400">{sig.label}</span>
                          <span className="text-slate-600">(+{sig.weight})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {doc.flagReason && (
                    <p className="text-red-400/80 text-xs mt-2 border-t border-white/5 pt-2">
                      {doc.flagReason}
                    </p>
                  )}
                </div>
              )
            })}
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
