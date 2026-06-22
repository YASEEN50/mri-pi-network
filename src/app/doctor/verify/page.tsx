'use client'
// src/app/doctor/verify/page.tsx
// نظام التحقق الإلزامي — 5 مراحل: شهادة → مزاولة → dataflow → هوية → سيلفي

import { useState, useEffect, useRef } from 'react'
import { useSession }  from 'next-auth/react'
import { useRouter }   from 'next/navigation'
import Image           from 'next/image'
import Link            from 'next/link'
import Navbar          from '@/components/common/Navbar'
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
    for (let i = 0; i < raw.length; i++) {
      h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0
    }
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

function StepBar({ stage }: { stage: UploadStageKey }) {
  const idx = UPLOAD_STAGES.findIndex(s => s.key === stage)
  return (
    <div className="flex items-center justify-center mb-8 overflow-x-auto pb-2">
      {UPLOAD_STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center flex-shrink-0">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm border-2 transition-all
              ${i < idx  ? 'bg-primary border-primary text-white' :
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

function FileDropZone({
  preview, onPick, loading, icon, emptyLabel,
}: {
  preview: string; onPick: (f: File) => void; loading?: boolean
  icon: string; emptyLabel: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div onClick={() => !loading && inputRef.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onPick(f) }}
      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${preview ? 'border-accent/50' : 'border-white/15'}`}>
      {preview
        ? <div>
            <Image src={preview} alt="" width={400} height={192} unoptimized
              className="max-h-48 mx-auto rounded-xl object-contain mb-2" />
            <p className="text-accent text-sm">✅ تم اختيار الملف — اضغط للتغيير</p>
          </div>
        : <div>
            <div className="text-4xl mb-2">{icon}</div>
            <p className="text-slate-300 font-medium">{emptyLabel}</p>
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
    <div className="px-4 py-3 rounded-xl text-sm bg-danger/10 border border-danger/20 text-red-400">
      {msg}
    </div>
  )
}

// ─── 1: الشهادة الجامعية ─────────────────────────────────────────────────────
function DegreeStage({ onDone }: { onDone: () => void }) {
  const [subType,   setSubType]   = useState<string>(DEGREE_TYPES.BACHELOR)
  const [legalName, setLegalName] = useState('')
  const [file,      setFile]      = useState<File | null>(null)
  const [preview,   setPreview]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

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
      const res  = await fetch('/api/doctor/upload-document', {
        method: 'POST',
        headers: { 'x-device-id': getDeviceId() },
        body: fd,
      })
      const data = await res.json()
      if (data.error || !data.success) {
        setError(data.message ?? 'حدث خطأ')
        return
      }
      onDone()
    } catch { setError('خطأ في الاتصال') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
        <p className="text-accent font-semibold text-sm mb-1">🎓 الشهادة الجامعية</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          ارفع شهادتك الجامعية (بكالوريوس أو ماجستير أو زمالة). يجب أن يظهر الاسم بوضوح — سيُستخدم للمطابقة مع الهوية لاحقاً.
        </p>
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-2 font-medium">نوع الشهادة <span className="text-red-400">*</span></label>
        <select value={subType} onChange={e => setSubType(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/50">
          {Object.entries(DEGREE_TYPE_LABELS).map(([k, label]) => (
            <option key={k} value={k} className="bg-slate-900">{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-2 font-medium">الاسم في الشهادة <span className="text-red-400">*</span></label>
        <input value={legalName} onChange={e => setLegalName(e.target.value)}
          placeholder="كما يظهر في الشهادة بالضبط"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/50" />
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-2 font-medium">صورة الشهادة <span className="text-red-400">*</span></label>
        <FileDropZone preview={preview} onPick={pickFile} loading={loading} icon="🎓" emptyLabel="اسحب الصورة أو اضغط للاختيار" />
      </div>

      <ErrorBox msg={error} />
      <button onClick={submit} disabled={loading || !file}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-all bg-primary hover:bg-primary-600 shadow-glow-primary">
        {loading ? 'جاري الرفع...' : 'رفع الشهادة والمتابعة →'}
      </button>
    </div>
  )
}

// ─── 2: مزاولة المهنة ────────────────────────────────────────────────────────
function LicenseStage({ onDone }: { onDone: () => void }) {
  const [file,    setFile]    = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [polling, setPolling] = useState(false)
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)

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
        const res  = await fetch('/api/doctor/verification-status')
        const data = await res.json()
        const jobs = data.data?.jobs ?? []
        const job  = jobs.find((j: { id?: string }) => j.id === jId)
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
      const res  = await fetch('/api/doctor/upload-license', {
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
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
        <p className="text-amber-400 font-semibold text-sm mb-1">📋 شهادة مزاولة المهنة</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          ارفع صورة واضحة لشهادة مزاولة المهنة من الهيئة السعودية للتخصصات الصحية.
          يجب أن تظهر: الاسم — التخصص — رقم الترخيص — تاريخ الانتهاء.
        </p>
      </div>
      <FileDropZone preview={preview} onPick={pickFile} loading={loading} icon="📋" emptyLabel="صورة شهادة المزاولة" />
      {polling && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20">
          <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full flex-shrink-0" />
          <p className="text-accent text-sm">جاري استخراج بيانات الرخصة...</p>
        </div>
      )}
      <ErrorBox msg={error} />
      <button onClick={submit} disabled={loading || polling || !file}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-all bg-gradient-to-br from-primary to-primary-700 hover:opacity-90">
        {loading ? 'جاري الرفع...' : polling ? 'جاري المعالجة...' : 'رفع شهادة المزاولة والمتابعة →'}
      </button>
    </div>
  )
}

// ─── 3: Dataflow ─────────────────────────────────────────────────────────────
function DataflowStage({ onDone }: { onDone: () => void }) {
  const [file,    setFile]    = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

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
      const res  = await fetch('/api/doctor/upload-document', {
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
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
        <p className="text-sky-400 font-semibold text-sm mb-1">📊 نتيجة Dataflow</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          ارفع تقرير أو شهادة Dataflow التي تثبت التحقق من مؤهلاتك الطبية دولياً.
        </p>
      </div>
      <FileDropZone preview={preview} onPick={pickFile} loading={loading} icon="📊" emptyLabel="نتيجة Dataflow (PDF أو صورة)" />
      <ErrorBox msg={error} />
      <button onClick={submit} disabled={loading || !file}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-all bg-gradient-to-br from-accent/80 to-primary hover:opacity-90">
        {loading ? 'جاري الرفع...' : 'رفع Dataflow والمتابعة →'}
      </button>
    </div>
  )
}

// ─── 4: الهوية ───────────────────────────────────────────────────────────────
function IdentityStage({ certificateName, onDone }: { certificateName: string; onDone: () => void }) {
  const [legalName, setLegalName] = useState(certificateName)
  const [file,      setFile]      = useState<File | null>(null)
  const [preview,   setPreview]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

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
      const res  = await fetch('/api/doctor/upload-document', {
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
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-success/10 border border-success/20">
        <p className="text-accent font-semibold text-sm mb-1">🪪 الهوية الوطنية / الإقامة / الجواز</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          الاسم في الهوية يجب أن يطابق الاسم في الشهادة الجامعية
          {certificateName && <span className="text-accent font-medium"> ({certificateName})</span>}.
        </p>
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-2 font-medium">الاسم في الهوية <span className="text-red-400">*</span></label>
        <input value={legalName} onChange={e => setLegalName(e.target.value)}
          placeholder="مطابق للشهادة"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary/50" />
      </div>
      <FileDropZone preview={preview} onPick={pickFile} loading={loading} icon="🪪" emptyLabel="صورة الهوية أو الجواز" />
      <ErrorBox msg={error} />
      <button onClick={submit} disabled={loading || !file}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-all bg-gradient-to-br from-success to-primary hover:opacity-90">
        {loading ? 'جاري الرفع...' : 'رفع الهوية والمتابعة →'}
      </button>
    </div>
  )
}

// ─── 5: سيلفي ────────────────────────────────────────────────────────────────
function SelfieStage({ onDone }: { onDone: () => void }) {
  const [file,    setFile]    = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [polling, setPolling] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)

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
        const res  = await fetch('/api/doctor/verification-status')
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
      const res  = await fetch('/api/doctor/upload-document', {
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
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-secondary/30 border border-primary/20">
        <p className="text-purple-400 font-semibold text-sm mb-1">🤳 صورة سيلفي</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          التقط صورة شخصية واضحة لوجهك — يجب أن تكون لنفس الشخص الظاهر في الهوية.
          <span className="text-amber-400 font-medium"> المراجعة البشرية إلزامية.</span>
        </p>
      </div>
      <div onClick={() => inputRef.current?.click()}
        className={`relative aspect-square max-w-xs mx-auto border-2 border-dashed rounded-2xl overflow-hidden cursor-pointer flex items-center justify-center ${preview ? 'border-accent/50' : 'border-white/15'}`}>
        {preview
          ? <Image src={preview} alt="" fill unoptimized className="object-cover" sizes="320px" />
          : <div className="text-center p-4"><div className="text-4xl mb-2">🤳</div><p className="text-slate-500 text-sm">اضغط لالتقاط أو اختيار صورة</p></div>
        }
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="user" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />
      {polling && (
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full flex-shrink-0" />
          <p className="text-accent text-sm">جاري مقارنة الوجه مع الهوية...</p>
        </div>
      )}
      <ErrorBox msg={error} />
      <button onClick={submit} disabled={loading || polling || !file}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-all bg-gradient-to-br from-primary to-secondary hover:opacity-90">
        {loading ? 'جاري الرفع...' : polling ? 'جاري المقارنة...' : '✅ إرسال للمراجعة البشرية'}
      </button>
      <p className="text-slate-500 text-xs text-center">🔒 صورك محفوظة بأمان وللتحقق فقط</p>
    </div>
  )
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────────────────────
export default function DoctorVerifyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stage,           setStage]           = useState<UploadStageKey>('degree')
  const [certificateName, setCertificateName] = useState('')
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') {
      if (session?.user?.role !== 'DOCTOR') { router.push('/unauthorized'); return }
      if (session?.user?.approvalStatus === 'APPROVED') { router.push('/dashboard/doctor/schedule'); return }

      fetch('/api/doctor/verification-status')
        .then(r => r.json())
        .then(d => {
          const uploadStage = (d.data?.uploadStage ?? 'degree') as UploadStageKey
          setStage(uploadStage)
          const degreeDoc = (d.data?.documents ?? []).find(
            (doc: { docType: string; legalName?: string }) => doc.docType === 'CREDENTIAL',
          )
          if (degreeDoc?.legalName) setCertificateName(degreeDoc.legalName)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [status, session, router])


  if (status === 'loading' || loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔐</div>
          <h1 className="text-2xl font-bold text-white">التحقق من هوية الطبيب</h1>
          <p className="text-slate-400 text-sm mt-1">5 مستندات مطلوبة لحماية سلامة المرضى</p>
        </div>

        <StepBar stage={stage} />

        <div className="mpi-card rounded-2xl p-6">
          {stage === 'degree'    && <DegreeStage    onDone={() => setStage('license')} />}
          {stage === 'license'   && <LicenseStage   onDone={() => setStage('dataflow')} />}
          {stage === 'dataflow'  && <DataflowStage  onDone={() => setStage('identity')} />}
          {stage === 'identity'  && (
            <IdentityStage
              certificateName={certificateName}
              onDone={() => setStage('selfie')}
            />
          )}
          {stage === 'selfie'    && <SelfieStage    onDone={() => setStage('submitted')} />}
          {stage === 'submitted' && (
            <div className="text-center py-6 space-y-4">
              <div className="text-5xl">⏳</div>
              <h2 className="text-xl font-bold text-white">طلبك قيد المراجعة البشرية</h2>
              <div className="space-y-3 text-right">
                {[
                  { icon: '✅', cls: 'bg-success/10 border-success/20 text-success', title: 'تم استلام جميع المستندات', desc: 'الشهادة، مزاولة المهنة، Dataflow، الهوية، والسيلفي' },
                  { icon: '👨‍💼', cls: 'bg-primary/10 border-primary/20 text-accent', title: 'مراجعة بشرية إلزامية', desc: 'يراجع فريقنا كل مستند ومطابقة الاسم والوجه' },
                  { icon: '⏱', cls: 'bg-warning/10 border-warning/20 text-warning', title: 'المدة المتوقعة: 1-3 أيام عمل', desc: 'ستصلك إشعار فور اتخاذ القرار' },
                ].map(item => (
                  <div key={item.title} className={`flex items-start gap-3 p-3 rounded-xl border ${item.cls}`}>
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/" className="inline-block mt-2 px-6 py-2.5 rounded-xl text-sm transition-all bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10">
                العودة للرئيسية
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
