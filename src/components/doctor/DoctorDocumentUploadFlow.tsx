'use client'
// src/components/doctor/DoctorDocumentUploadFlow.tsx
// رفع الوثائق الخمسة — يُستخدم في الملف الشخصي (شريط جانبي) وصفحة /doctor/verify

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  UPLOAD_STAGES,
  DEGREE_TYPES,
  DEGREE_TYPE_LABELS,
  DOC_TYPES,
  type UploadStageKey,
} from '@/lib/verification/document-types'

function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server'
  const key = 'mtp_did'
  let did = localStorage.getItem(key)
  if (!did) {
    const nav = window.navigator
    const raw = [
      nav.userAgent, nav.language, nav.hardwareConcurrency ?? '',
      screen.width, screen.height, screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join('|')
    let h = 0
    for (let i = 0; i < raw.length; i++) h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0
    did = Math.abs(h).toString(36) + Date.now().toString(36)
    try { localStorage.setItem(key, did) } catch {}
  }
  return did
}

async function compressIfImage(f: File): Promise<File> {
  if (!f.type.startsWith('image/')) return f
  try {
    const { compressImageForUpload } = await import('@/lib/client/image-compress')
    return compressImageForUpload(f)
  } catch {
    return f
  }
}

function FileDropZone({
  preview, onPick, loading, icon, emptyLabel, compact,
}: {
  preview: string; onPick: (f: File) => void; loading?: boolean
  icon: string; emptyLabel: string; compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div onClick={() => !loading && inputRef.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onPick(f) }}
      className={`border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${compact ? 'p-4' : 'p-6'} ${preview ? 'border-accent/50' : 'border-white/15'}`}>
      {preview
        ? <div>
            <Image src={preview} alt="" width={400} height={192} unoptimized
              className={`mx-auto rounded-lg object-contain mb-2 ${compact ? 'max-h-32' : 'max-h-48'}`} />
            <p className="text-accent text-xs">✅ تم اختيار الملف — اضغط للتغيير</p>
          </div>
        : <div>
            <div className={`mb-1 ${compact ? 'text-2xl' : 'text-4xl'}`}>{icon}</div>
            <p className="text-slate-300 text-sm font-medium">{emptyLabel}</p>
            <p className="text-slate-500 text-xs mt-1">PNG, JPG, PDF — حد 10MB</p>
          </div>
      }
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f) }} />
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div className="px-3 py-2 rounded-lg text-xs bg-danger/10 border border-danger/20 text-red-400">
      {msg}
    </div>
  )
}

function StepBar({ stage, variant }: { stage: UploadStageKey; variant: 'horizontal' | 'vertical' }) {
  const idx = UPLOAD_STAGES.findIndex(s => s.key === stage)
  const uploadSteps = UPLOAD_STAGES.filter(s => s.key !== 'submitted')

  if (variant === 'vertical') {
    return (
      <ul className="space-y-1 mb-4">
        {uploadSteps.map((s, i) => {
          const done = i < idx
          const active = i === idx
          return (
            <li key={s.key}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                active ? 'bg-primary/15 border border-primary/30 text-accent' :
                done ? 'bg-success/10 text-success' : 'text-slate-500'
              }`}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0"
                style={{
                  background: done ? '#10b981' : active ? 'rgba(10,102,194,0.3)' : 'rgba(255,255,255,0.06)',
                  color: done || active ? 'white' : '#64748b',
                }}>
                {done ? '✓' : s.icon}
              </span>
              <span className="font-medium">{s.label}</span>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="flex items-center justify-center mb-6 overflow-x-auto pb-2">
      {UPLOAD_STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center flex-shrink-0">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm border-2 transition-all
              ${i < idx ? 'bg-primary border-primary text-white' :
                i === idx ? 'bg-primary/20 border-accent text-accent' :
                'bg-white/5 border-white/10 text-slate-500'}`}>
              {i < idx ? '✓' : s.icon}
            </div>
            <span className={`text-[10px] sm:text-xs w-14 sm:w-16 text-center leading-tight ${
              i === idx ? 'text-accent' : i < idx ? 'text-primary-400' : 'text-slate-600'}`}>
              {s.label}
            </span>
          </div>
          {i < UPLOAD_STAGES.length - 1 && (
            <div className={`w-6 sm:w-8 h-0.5 mb-5 mx-0.5 transition-all ${i < idx ? 'bg-primary' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function DegreeStage({ onDone, compact }: { onDone: () => void; compact?: boolean }) {
  const [subType, setSubType] = useState<string>(DEGREE_TYPES.BACHELOR)
  const [legalName, setLegalName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function pickFile(f: File) {
    if (f.size > 10 * 1024 * 1024) { setError('الحجم الأقصى 10MB'); return }
    setError('')
    setLoading(true)
    try {
      const compressed = await compressIfImage(f)
      setFile(compressed)
      const r = new FileReader()
      r.onload = e => setPreview(e.target?.result as string)
      r.readAsDataURL(compressed)
    } finally { setLoading(false) }
  }

  async function submit() {
    if (!legalName.trim()) { setError('أدخل الاسم كما يظهر في الشهادة'); return }
    if (!file) { setError('ارفع صورة الشهادة'); return }
    setLoading(true); setError('')
    const fd = new FormData()
    fd.append('docType', DOC_TYPES.CREDENTIAL)
    fd.append('subType', subType)
    fd.append('legalName', legalName.trim())
    fd.append('file', file)
    try {
      const res = await fetch('/api/doctor/upload-document', {
        method: 'POST',
        headers: { 'x-device-id': getDeviceId() },
        body: fd,
      })
      const data = await res.json()
      if (data.error || !data.success) { setError(data.message ?? 'حدث خطأ'); return }
      onDone()
    } catch { setError('خطأ في الاتصال') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <p className="text-slate-400 text-xs leading-relaxed">
          ارفع شهادتك الجامعية. يجب أن يظهر الاسم بوضوح للمطابقة مع الهوية.
        </p>
      )}
      <select value={subType} onChange={e => setSubType(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary/50">
        {Object.entries(DEGREE_TYPE_LABELS).map(([k, label]) => (
          <option key={k} value={k} className="bg-slate-900">{label}</option>
        ))}
      </select>
      <input value={legalName} onChange={e => setLegalName(e.target.value)}
        placeholder="الاسم في الشهادة *"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary/50" />
      <FileDropZone preview={preview} onPick={pickFile} loading={loading} icon="🎓"
        emptyLabel="صورة الشهادة" compact={compact} />
      <ErrorBox msg={error} />
      <button onClick={submit} disabled={loading || !file}
        className="w-full py-2.5 rounded-xl text-white font-semibold text-xs disabled:opacity-50 bg-primary hover:bg-primary-600 transition-all">
        {loading ? 'جاري الرفع...' : 'رفع الشهادة →'}
      </button>
    </div>
  )
}

function LicenseStage({ onDone, compact }: { onDone: () => void; compact?: boolean }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [polling, setPolling] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function pickFile(f: File) {
    if (f.size > 10 * 1024 * 1024) { setError('الحجم الأقصى 10MB'); return }
    setError('')
    setLoading(true)
    try {
      const compressed = await compressIfImage(f)
      setFile(compressed)
      const r = new FileReader()
      r.onload = e => setPreview(e.target?.result as string)
      r.readAsDataURL(compressed)
    } finally { setLoading(false) }
  }

  function startPolling(jId: string) {
    setPolling(true)
    let tries = 0
    pollRef.current = setInterval(async () => {
      tries++
      if (tries > 24) {
        clearInterval(pollRef.current!)
        setPolling(false)
        setError('انتهت مهلة المعالجة. جرب مجدداً.')
        return
      }
      try {
        const res = await fetch('/api/doctor/verification-status')
        const data = await res.json()
        const jobs = data.data?.jobs ?? []
        const job = jobs.find((j: { id?: string }) => j.id === jId)
        if (job?.status === 'completed' || job?.status === 'failed' || job?.status === 'dead') {
          clearInterval(pollRef.current!)
          setPolling(false)
          onDone()
        }
        if (data.data?.steps?.licenseUploaded) {
          clearInterval(pollRef.current!)
          setPolling(false)
          onDone()
        }
      } catch {}
    }, 5000)
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function submit() {
    if (!file) { setError('يرجى اختيار صورة شهادة المزاولة'); return }
    setLoading(true); setError('')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/doctor/upload-license', {
        method: 'POST',
        headers: { 'x-idempotency-key': crypto.randomUUID(), 'x-device-id': getDeviceId() },
        body: formData,
      })
      const data = await res.json()
      if (data.error || data.data?.error) {
        setError(data.message ?? data.data?.message ?? 'حدث خطأ')
        return
      }
      const jId = data.jobId ?? data.data?.jobId
      if (jId) startPolling(jId)
      else onDone()
    } catch { setError('خطأ في الاتصال') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <p className="text-slate-400 text-xs">شهادة مزاولة المهنة من الهيئة السعودية للتخصصات الصحية.</p>
      )}
      <FileDropZone preview={preview} onPick={pickFile} loading={loading} icon="📋"
        emptyLabel="صورة شهادة المزاولة" compact={compact} />
      {polling && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full shrink-0" />
          <p className="text-accent text-xs">جاري استخراج بيانات الرخصة...</p>
        </div>
      )}
      <ErrorBox msg={error} />
      <button onClick={submit} disabled={loading || polling || !file}
        className="w-full py-2.5 rounded-xl text-white font-semibold text-xs disabled:opacity-50 bg-primary hover:bg-primary-600 transition-all">
        {loading ? 'جاري الرفع...' : polling ? 'جاري المعالجة...' : 'رفع الرخصة →'}
      </button>
    </div>
  )
}

function DataflowStage({ onDone, compact }: { onDone: () => void; compact?: boolean }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function pickFile(f: File) {
    if (f.size > 10 * 1024 * 1024) { setError('الحجم الأقصى 10MB'); return }
    setError('')
    setLoading(true)
    try {
      const compressed = await compressIfImage(f)
      setFile(compressed)
      const r = new FileReader()
      r.onload = e => setPreview(e.target?.result as string)
      r.readAsDataURL(compressed)
    } finally { setLoading(false) }
  }

  async function submit() {
    if (!file) { setError('ارفع نتيجة Dataflow'); return }
    setLoading(true); setError('')
    const fd = new FormData()
    fd.append('docType', DOC_TYPES.DATAFLOW)
    fd.append('file', file)
    try {
      const res = await fetch('/api/doctor/upload-document', {
        method: 'POST',
        headers: { 'x-device-id': getDeviceId() },
        body: fd,
      })
      const data = await res.json()
      if (data.error || !data.success) { setError(data.message ?? 'حدث خطأ'); return }
      onDone()
    } catch { setError('خطأ في الاتصال') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <FileDropZone preview={preview} onPick={pickFile} loading={loading} icon="📊"
        emptyLabel="نتيجة Dataflow" compact={compact} />
      <ErrorBox msg={error} />
      <button onClick={submit} disabled={loading || !file}
        className="w-full py-2.5 rounded-xl text-white font-semibold text-xs disabled:opacity-50 bg-primary hover:bg-primary-600 transition-all">
        {loading ? 'جاري الرفع...' : 'رفع Dataflow →'}
      </button>
    </div>
  )
}

function IdentityStage({ certificateName, onDone, compact }: { certificateName: string; onDone: () => void; compact?: boolean }) {
  const [legalName, setLegalName] = useState(certificateName)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function pickFile(f: File) {
    if (f.size > 10 * 1024 * 1024) { setError('الحجم الأقصى 10MB'); return }
    setError('')
    setLoading(true)
    try {
      const compressed = await compressIfImage(f)
      setFile(compressed)
      const r = new FileReader()
      r.onload = e => setPreview(e.target?.result as string)
      r.readAsDataURL(compressed)
    } finally { setLoading(false) }
  }

  async function submit() {
    if (!legalName.trim()) { setError('أدخل الاسم كما يظهر في الهوية'); return }
    if (!file) { setError('ارفع صورة الهوية'); return }
    setLoading(true); setError('')
    const fd = new FormData()
    fd.append('docType', DOC_TYPES.ID_DOCUMENT)
    fd.append('legalName', legalName.trim())
    fd.append('file', file)
    try {
      const res = await fetch('/api/doctor/upload-document', {
        method: 'POST',
        headers: { 'x-device-id': getDeviceId() },
        body: fd,
      })
      const data = await res.json()
      if (data.error || !data.success) { setError(data.message ?? 'حدث خطأ'); return }
      onDone()
    } catch { setError('خطأ في الاتصال') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      {certificateName && (
        <p className="text-slate-400 text-xs">يجب مطابقة الاسم مع الشهادة: <span className="text-accent">{certificateName}</span></p>
      )}
      <input value={legalName} onChange={e => setLegalName(e.target.value)}
        placeholder="الاسم في الهوية *"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-primary/50" />
      <FileDropZone preview={preview} onPick={pickFile} loading={loading} icon="🪪"
        emptyLabel="صورة الهوية أو الجواز" compact={compact} />
      <ErrorBox msg={error} />
      <button onClick={submit} disabled={loading || !file}
        className="w-full py-2.5 rounded-xl text-white font-semibold text-xs disabled:opacity-50 bg-primary hover:bg-primary-600 transition-all">
        {loading ? 'جاري الرفع...' : 'رفع الهوية →'}
      </button>
    </div>
  )
}

function SelfieStage({ onDone, compact }: { onDone: () => void; compact?: boolean }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [polling, setPolling] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function pickFile(f: File) {
    if (f.size > 10 * 1024 * 1024) { setError('الحجم الأقصى 10MB'); return }
    setError('')
    setLoading(true)
    try {
      const compressed = await compressIfImage(f)
      setFile(compressed)
      const r = new FileReader()
      r.onload = e => setPreview(e.target?.result as string)
      r.readAsDataURL(compressed)
    } finally { setLoading(false) }
  }

  function startFacePolling() {
    setPolling(true)
    let tries = 0
    pollRef.current = setInterval(async () => {
      tries++
      if (tries > 24) {
        clearInterval(pollRef.current!)
        setPolling(false)
        onDone()
        return
      }
      try {
        const res = await fetch('/api/doctor/verification-status')
        const data = await res.json()
        const state = data.data?.verificationStatus
        if (['PENDING_HUMAN', 'ADMIN_REVIEW', 'APPROVED', 'FACE_SUBMITTED', 'FRAUD_CHECK', 'SCORING'].includes(state)) {
          clearInterval(pollRef.current!)
          setPolling(false)
          onDone()
        }
        const jobs = data.data?.jobs ?? []
        const faceJob = jobs.find((j: { jobType?: string }) => j.jobType === 'face-comparison')
        if (faceJob?.status === 'completed' || faceJob?.status === 'dead' || faceJob?.status === 'failed') {
          clearInterval(pollRef.current!)
          setPolling(false)
          onDone()
        }
      } catch {}
    }, 5000)
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function submit() {
    if (!file) { setError('الصورة الشخصية مطلوبة'); return }
    setLoading(true); setError('')
    const fd = new FormData()
    fd.append('docType', DOC_TYPES.SELFIE)
    fd.append('file', file)
    try {
      const res = await fetch('/api/doctor/upload-document', {
        method: 'POST',
        headers: { 'x-device-id': getDeviceId() },
        body: fd,
      })
      const data = await res.json()
      if (data.error || !data.success) { setError(data.message ?? 'حدث خطأ'); return }
      startFacePolling()
    } catch { setError('خطأ في الاتصال') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <div onClick={() => inputRef.current?.click()}
        className={`relative aspect-square max-w-[200px] mx-auto border-2 border-dashed rounded-xl overflow-hidden cursor-pointer flex items-center justify-center ${preview ? 'border-accent/50' : 'border-white/15'}`}>
        {preview
          ? <Image src={preview} alt="" fill unoptimized className="object-cover" sizes="200px" />
          : <div className="text-center p-3"><div className="text-3xl mb-1">🤳</div><p className="text-slate-500 text-xs">صورة سيلفي</p></div>
        }
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="user" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />
      {polling && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
          <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full shrink-0" />
          <p className="text-accent text-xs">جاري مقارنة الوجه...</p>
        </div>
      )}
      <ErrorBox msg={error} />
      <button onClick={submit} disabled={loading || polling || !file}
        className="w-full py-2.5 rounded-xl text-white font-semibold text-xs disabled:opacity-50 bg-primary hover:bg-primary-600 transition-all">
        {loading ? 'جاري الرفع...' : polling ? 'جاري المقارنة...' : '✅ إرسال للمراجعة'}
      </button>
    </div>
  )
}

function SubmittedView({ compact }: { compact?: boolean }) {
  return (
    <div className={`text-center space-y-3 ${compact ? 'py-2' : 'py-6'}`}>
      <div className={compact ? 'text-3xl' : 'text-5xl'}>⏳</div>
      <h2 className={`font-bold text-white ${compact ? 'text-sm' : 'text-xl'}`}>طلبك قيد المراجعة</h2>
      <p className="text-slate-400 text-xs leading-relaxed">
        تم استلام جميع المستندات. المراجعة البشرية تستغرق عادةً 1–3 أيام عمل.
      </p>
      {!compact && (
        <Link href="/" className="inline-block mt-2 px-5 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-slate-400 hover:text-white">
          العودة للرئيسية
        </Link>
      )}
    </div>
  )
}

function ApprovedView({ compact }: { compact?: boolean }) {
  return (
    <div className={`text-center rounded-xl bg-success/10 border border-success/25 ${compact ? 'p-4' : 'p-8'}`}>
      <div className={compact ? 'text-2xl mb-1' : 'text-5xl mb-3'}>✅</div>
      <h3 className={`text-success font-bold ${compact ? 'text-sm' : 'text-xl'}`}>طبيب موثق</h3>
      <p className="text-slate-400 text-xs mt-1">تم التحقق من جميع الوثائق بنجاح.</p>
    </div>
  )
}

export type DoctorDocumentUploadVariant = 'page' | 'sidebar'

export default function DoctorDocumentUploadFlow({
  variant = 'sidebar',
  approvalStatus,
}: {
  variant?: DoctorDocumentUploadVariant
  approvalStatus?: string
}) {
  const compact = variant === 'sidebar'
  const [stage, setStage] = useState<UploadStageKey>('degree')
  const [certificateName, setCertificateName] = useState('')
  const [verificationStatus, setVerificationStatus] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/doctor/verification-status')
      const d = await res.json()
      const uploadStage = (d.data?.uploadStage ?? 'degree') as UploadStageKey
      setStage(uploadStage)
      setVerificationStatus(d.data?.verificationStatus ?? '')
      const degreeDoc = (d.data?.documents ?? []).find(
        (doc: { docType: string; legalName?: string }) => doc.docType === 'CREDENTIAL',
      )
      if (degreeDoc?.legalName) setCertificateName(degreeDoc.legalName)
    } catch {}
  }, [])

  useEffect(() => {
    refreshStatus().finally(() => setLoading(false))
  }, [refreshStatus])

  const handleDone = useCallback(async () => {
    await refreshStatus()
  }, [refreshStatus])

  if (loading) {
    return (
      <div className={`flex justify-center ${compact ? 'py-8' : 'py-16'}`}>
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (approvalStatus === 'APPROVED' || verificationStatus === 'APPROVED') {
    return <ApprovedView compact={compact} />
  }

  const stepBarVariant = variant === 'sidebar' ? 'vertical' : 'horizontal'

  return (
    <div>
      {variant === 'page' && (
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-white">التحقق من هوية الطبيب</h2>
          <p className="text-slate-400 text-sm mt-1">5 مستندات مطلوبة</p>
        </div>
      )}

      {stage !== 'submitted' && (
        <StepBar stage={stage} variant={stepBarVariant} />
      )}

      <div className={compact ? '' : 'mpi-card rounded-2xl p-6'}>
        {stage === 'degree' && <DegreeStage onDone={() => handleDone()} compact={compact} />}
        {stage === 'license' && <LicenseStage onDone={() => handleDone()} compact={compact} />}
        {stage === 'dataflow' && <DataflowStage onDone={() => handleDone()} compact={compact} />}
        {stage === 'identity' && (
          <IdentityStage certificateName={certificateName} onDone={() => handleDone()} compact={compact} />
        )}
        {stage === 'selfie' && <SelfieStage onDone={() => handleDone()} compact={compact} />}
        {stage === 'submitted' && <SubmittedView compact={compact} />}
      </div>
    </div>
  )
}
