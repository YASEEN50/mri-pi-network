'use client'
// src/components/profile/DoctorVerificationPanel.tsx
// لوحة التحقق الطبي — تظهر في تبويب "التحقق الطبي" بالملف الشخصي

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'

// ─── Types ────────────────────────────────────────────────────────────────────

type VerifState =
  | 'PENDING_AI'
  | 'UNVERIFIED'
  | 'LICENSE_UPLOADED'
  | 'CREDENTIALS_UPLOADED'
  | 'FACE_SUBMITTED'
  | 'FRAUD_CHECK'
  | 'SCORING'
  | 'ADMIN_REVIEW'
  | 'PENDING_HUMAN'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVERIFY_REQUIRED'

type PanelView = 'status' | 'license' | 'credentials' | 'face'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server'
  const key = 'mtp_did'
  let did = localStorage.getItem(key)
  if (!did) {
    const nav = window.navigator
    const raw = [nav.userAgent, nav.language, nav.hardwareConcurrency ?? '',
      screen.width, screen.height, screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone].join('|')
    let h = 0
    for (let i = 0; i < raw.length; i++) h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0
    did = Math.abs(h).toString(36) + Date.now().toString(36)
    try { localStorage.setItem(key, did) } catch {}
  }
  return did
}

const STATE_INFO: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  PENDING_AI:           { label: 'بانتظار المسح الآلي', icon: '🤖', color: '#6366f1', desc: 'سيتم تحليل الرخصة آلياً بعد الرفع' },
  UNVERIFIED:           { label: 'غير موثق',          icon: '⚪', color: '#64748b', desc: 'لم يبدأ التحقق بعد' },
  LICENSE_UPLOADED:     { label: 'الرخصة مرفوعة',     icon: '📋', color: '#f59e0b', desc: 'جاري معالجة رخصتك' },
  CREDENTIALS_UPLOADED: { label: 'الشهادات مرفوعة',   icon: '🎓', color: '#f59e0b', desc: 'في انتظار التحقق من الهوية' },
  FACE_SUBMITTED:       { label: 'الهوية مرفوعة',     icon: '🪪', color: '#3b82f6', desc: 'جاري مقارنة الوجه' },
  FRAUD_CHECK:          { label: 'فحص أمني',          icon: '🔍', color: '#8b5cf6', desc: 'جاري فحص الوثائق' },
  SCORING:              { label: 'تقييم الطلب',        icon: '📊', color: '#8b5cf6', desc: 'جاري حساب درجة المخاطرة' },
  ADMIN_REVIEW:         { label: 'قيد المراجعة البشرية', icon: '⏳', color: '#f59e0b', desc: 'طلبك عند فريق المراجعة' },
  PENDING_HUMAN:        { label: 'قيد المراجعة البشرية', icon: '⏳', color: '#f59e0b', desc: 'طلبك عند فريق المراجعة' },
  APPROVED:             { label: 'موثق ✓',             icon: '✅', color: '#10b981', desc: 'تم التحقق من هويتك الطبية' },
  REJECTED:             { label: 'مرفوض',             icon: '❌', color: '#ef4444', desc: 'تم رفض طلب التحقق' },
  REVERIFY_REQUIRED:    { label: 'إعادة التحقق مطلوبة', icon: '🔄', color: '#f97316', desc: 'يرجى إعادة تقديم وثائقك' },
}

const STEPS = [
  { key: 'license',     label: 'رخصة المزاولة',     icon: '📋', state: 'LICENSE_UPLOADED' },
  { key: 'credentials', label: 'الشهادات العلمية',   icon: '🎓', state: 'CREDENTIALS_UPLOADED' },
  { key: 'face',        label: 'التحقق من الهوية',   icon: '🪪', state: 'FACE_SUBMITTED' },
  { key: 'review',      label: 'مراجعة الفريق',      icon: '⏳', state: 'ADMIN_REVIEW' },
]

const ORDERED_STATES: VerifState[] = [
  'PENDING_AI', 'UNVERIFIED', 'LICENSE_UPLOADED', 'CREDENTIALS_UPLOADED',
  'FACE_SUBMITTED', 'FRAUD_CHECK', 'SCORING', 'ADMIN_REVIEW', 'PENDING_HUMAN', 'APPROVED',
]

function stateIndex(s: string) {
  return ORDERED_STATES.indexOf(s as VerifState)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ state }: { state: string }) {
  const idx = Math.max(stateIndex(state), 0)
  const pct  = Math.min(Math.round((idx / (ORDERED_STATES.length - 1)) * 100), 100)
  const info = STATE_INFO[state] ?? STATE_INFO['UNVERIFIED']

  return (
    <div className="rounded-2xl p-5 mb-5"
      style={{ background: `${info.color}10`, border: `1px solid ${info.color}30` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{info.icon}</span>
          <div>
            <p className="text-white font-semibold text-sm">{info.label}</p>
            <p className="text-slate-400 text-xs">{info.desc}</p>
          </div>
        </div>
        <span className="text-lg font-bold" style={{ color: info.color }}>{pct}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: info.color }} />
      </div>
      {/* Steps */}
      <div className="flex justify-between mt-3">
        {STEPS.map((step, i) => {
          const done  = stateIndex(state) > stateIndex(step.state)
          const active = state === step.state ||
            (step.state === 'FACE_SUBMITTED' && ['FACE_SUBMITTED','FRAUD_CHECK','SCORING'].includes(state)) ||
            (step.state === 'ADMIN_REVIEW'   && ['ADMIN_REVIEW','PENDING_HUMAN','APPROVED'].includes(state))
          return (
            <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all"
                style={{
                  background: done ? '#10b981' : active ? info.color : 'rgba(255,255,255,0.08)',
                  color:      done || active ? 'white' : '#475569',
                }}>
                {done ? '✓' : step.icon}
              </div>
              <span className="text-xs text-center leading-tight hidden sm:block"
                style={{ color: done || active ? info.color : '#475569' }}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── License Upload ───────────────────────────────────────────────────────────

function LicenseUpload({ onDone }: { onDone: () => void }) {
  const [file, setFile]       = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [polling, setPolling] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef  = useRef<any>(null)

  async function pickFile(f: File) {
    if (f.size > 10 * 1024 * 1024) { setError('الحجم الأقصى 10MB'); return }
    setError('')
    setLoading(true)
    let toUse = f
    try {
      const { compressImageForUpload } = await import('@/lib/client/image-compress')
      toUse = await compressImageForUpload(f)
      setFile(toUse)
    } catch {
      setFile(f)
      toUse = f
    } finally {
      setLoading(false)
    }
    const r = new FileReader()
    r.onload = e => setPreview(e.target?.result as string)
    r.readAsDataURL(toUse)
  }

  function startPolling(jId: string) {
    setPolling(true)
    let tries = 0
    pollRef.current = setInterval(async () => {
      tries++
      if (tries > 30) {
        clearInterval(pollRef.current); setPolling(false)
        onDone(); return
      }
      try {
        const res  = await fetch('/api/doctor/verification-status')
        const data = await res.json()
        const state = data.data?.verificationStatus
        if (state && state !== 'UNVERIFIED') {
          clearInterval(pollRef.current); setPolling(false); onDone(); return
        }
        const jobs = data.data?.jobs ?? []
        const job  = jobs.find((j: any) => j.id === jId || j.jobType === 'ocr')
        if (job?.status === 'completed' || job?.status === 'failed' || job?.status === 'dead') {
          clearInterval(pollRef.current); setPolling(false); onDone()
        }
      } catch {}
    }, 4000)
  }

  useEffect(() => () => clearInterval(pollRef.current), [])

  async function submit() {
    if (!file) { setError('يرجى اختيار صورة رخصة المزاولة'); return }
    setLoading(true); setError('')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res  = await fetch('/api/doctor/upload-license', {
        method: 'POST',
        headers: { 'x-idempotency-key': crypto.randomUUID(), 'x-device-id': getDeviceId() },
        body: fd,
      })
      const data = await res.json()
      if (data.error || data.data?.error) { setError(data.message ?? data.data?.message ?? 'حدث خطأ'); return }
      const jId = data.jobId ?? data.data?.jobId
      if (jId) startPolling(jId)
      else onDone()
    } catch { setError('خطأ في الاتصال') }
    finally { setLoading(false) }
  }

  if (polling) return (
    <div className="py-10 text-center space-y-3">
      <div className="animate-spin w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full mx-auto" />
      <p className="text-white font-medium">جاري معالجة الرخصة بواسطة OCR...</p>
      <p className="text-slate-500 text-sm">قد يستغرق دقيقة أو دقيقتين</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <p className="text-amber-400 font-semibold text-sm mb-1">📋 رخصة مزاولة المهنة</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          ارفع صورة واضحة لرخصة مزاولة المهنة الصادرة من الهيئة السعودية للتخصصات الصحية.
          يجب أن تظهر: <span className="text-white">الاسم — التخصص — رقم الترخيص — تاريخ الانتهاء</span>
        </p>
      </div>

      {preview ? (
        <div className="relative rounded-xl overflow-hidden" style={{ maxHeight: 200 }}>
          <Image src={preview} alt="preview" width={800} height={200} unoptimized className="w-full object-cover" />
          <button onClick={() => { setFile(null); setPreview('') }}
            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-red-500/80 text-white text-xs flex items-center justify-center">
            ✕
          </button>
        </div>
      ) : (
        <div onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
          style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)' }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) pickFile(f) }}>
          <div className="text-3xl mb-2">📷</div>
          <p className="text-slate-300 text-sm">انقر أو اسحب الصورة هنا</p>
          <p className="text-slate-500 text-xs mt-1">JPG, PNG, PDF — حتى 10MB</p>
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button onClick={submit} disabled={!file || loading}
        className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-40"
        style={{ background: !file || loading ? undefined : 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
        {loading ? 'جاري الرفع...' : 'رفع الرخصة →'}
      </button>
    </div>
  )
}

// ─── Credentials Upload ───────────────────────────────────────────────────────

function CredentialsUpload({ onDone }: { onDone: () => void }) {
  const [entries, setEntries] = useState([{ title: '', file: null as File | null }])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [uploaded, setUploaded] = useState(0)

  async function submit() {
    const valid = entries.filter(e => e.title.trim() && e.file)
    if (!valid.length) { setError('أضف شهادة واحدة على الأقل'); return }
    setLoading(true); setError('')
    let count = 0
    for (const entry of valid) {
      const fd = new FormData()
      fd.append('file', entry.file!)
      fd.append('title', entry.title)
      try {
        const res = await fetch('/api/doctor/upload-credentials', { method: 'POST', body: fd })
        const data = await res.json()
        if (!data.error && !data.data?.error) count++
      } catch {}
    }
    setUploaded(count)
    setLoading(false)
    if (count > 0) onDone()
    else setError('فشل رفع الشهادات، حاول مجدداً')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
        <p className="text-purple-400 font-semibold text-sm mb-1">🎓 الشهادات العلمية (اختياري لكن يُحسّن التحقق)</p>
        <p className="text-slate-400 text-xs">ارفع صور شهاداتك الجامعية والتخصصية</p>
      </div>

      {entries.map((entry, idx) => (
        <div key={idx} className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <input value={entry.title} placeholder="عنوان الشهادة (مثال: بكالوريوس طب — جامعة الملك سعود — 2015)"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
            onChange={e => setEntries(prev => prev.map((p, i) => i === idx ? { ...p, title: e.target.value } : p))} />
          <div className="flex items-center gap-3">
            <label className="flex-1 cursor-pointer">
              <div className="border border-dashed rounded-lg p-3 text-center text-xs text-slate-400 hover:border-purple-500/40 transition-all"
                style={{ borderColor: entry.file ? 'rgba(139,92,246,0.4)' : undefined }}>
                {entry.file ? `✅ ${entry.file.name}` : '📁 اختر ملف الشهادة'}
              </div>
              <input type="file" accept="image/*,.pdf" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) setEntries(prev => prev.map((p, i) => i === idx ? { ...p, file: f } : p))
                }} />
            </label>
            {entries.length > 1 && (
              <button onClick={() => setEntries(prev => prev.filter((_, i) => i !== idx))}
                className="text-red-400 hover:text-red-300 text-sm px-2">✕</button>
            )}
          </div>
        </div>
      ))}

      <button onClick={() => setEntries(prev => [...prev, { title: '', file: null }])}
        className="w-full py-2 rounded-xl text-sm transition-all"
        style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
        + إضافة شهادة أخرى
      </button>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button onClick={onDone}
          className="flex-1 py-3 rounded-xl text-sm text-slate-400 border border-white/10 hover:border-white/20 transition-all">
          تخطي (بدون شهادات)
        </button>
        <button onClick={submit} disabled={loading}
          className="flex-1 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}>
          {loading ? `جاري رفع ${entries.filter(e=>e.file&&e.title).length} شهادات...` : 'رفع الشهادات →'}
        </button>
      </div>
    </div>
  )
}

// ─── Face Upload ──────────────────────────────────────────────────────────────

function FaceUpload({ onDone }: { onDone: () => void }) {
  const [selfie, setSelfie]   = useState<File | null>(null)
  const [idDoc, setIdDoc]     = useState<File | null>(null)
  const [selfieP, setSelfieP] = useState('')
  const [idDocP, setIdDocP]   = useState('')
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError]     = useState('')
  const pollRef = useRef<any>(null)

  function readPreview(f: File, setter: (s: string) => void) {
    const r = new FileReader(); r.onload = e => setter(e.target?.result as string); r.readAsDataURL(f)
  }

  function startPolling() {
    setPolling(true); let tries = 0
    pollRef.current = setInterval(async () => {
      tries++
      if (tries > 30) { clearInterval(pollRef.current); setPolling(false); onDone(); return }
      try {
        const res  = await fetch('/api/doctor/verification-status')
        const data = await res.json()
        const state = data.data?.verificationStatus
        if (['ADMIN_REVIEW','PENDING_HUMAN','APPROVED','FACE_SUBMITTED','FRAUD_CHECK','SCORING'].includes(state)) {
          clearInterval(pollRef.current); setPolling(false); onDone()
        }
        const jobs = data.data?.jobs ?? []
        const faceJob = jobs.find((j: any) => j.jobType === 'face-comparison')
        if (['completed','failed','dead'].includes(faceJob?.status)) {
          clearInterval(pollRef.current); setPolling(false); onDone()
        }
      } catch {}
    }, 4000)
  }

  useEffect(() => () => clearInterval(pollRef.current), [])

  async function submit() {
    if (!selfie) { setError('الصورة الشخصية مطلوبة'); return }
    if (!idDoc)  { setError('صورة الوثيقة الرسمية مطلوبة'); return }
    setLoading(true); setError('')
    const fd = new FormData()
    fd.append('selfie', selfie)
    fd.append('idDocument', idDoc)
    try {
      const res  = await fetch('/api/doctor/upload-face-v2', {
        method: 'POST', headers: { 'x-device-id': getDeviceId() }, body: fd,
      })
      const data = await res.json()
      if (data.error || data.data?.error) { setError(data.message ?? data.data?.message ?? 'حدث خطأ'); return }
      startPolling()
    } catch { setError('خطأ في الاتصال') }
    finally { setLoading(false) }
  }

  if (polling) return (
    <div className="py-10 text-center space-y-3">
      <div className="animate-spin w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
      <p className="text-white font-medium">جاري مقارنة الوجه ومراجعة الوثائق...</p>
      <p className="text-slate-500 text-sm">سيُرسَل طلبك تلقائياً للمراجعة البشرية</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <p className="text-blue-400 font-semibold text-sm mb-1">🪪 التحقق من الهوية</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          ارفع <span className="text-white">صورة شخصية واضحة</span> + <span className="text-white">صورة وثيقة رسمية</span>
          {' '}(هوية وطنية / جواز سفر / إقامة).
          المراجعة البشرية إلزامية بعد ذلك.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'صورة شخصية (سيلفي)', file: selfie, preview: selfieP, setter: setSelfie, prevSetter: setSelfieP, icon: '🤳' },
          { label: 'وثيقة رسمية',         file: idDoc,  preview: idDocP,  setter: setIdDoc,  prevSetter: setIdDocP,  icon: '🪪' },
        ].map(({ label, file, preview, setter, prevSetter, icon }) => (
          <div key={label}>
            <p className="text-slate-300 text-xs font-medium mb-1.5">{label}</p>
            <label className="cursor-pointer block">
              <div className="relative aspect-square rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed transition-all"
                style={{ borderColor: file ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                {preview
                  ? <Image src={preview} alt="" fill unoptimized className="object-cover" sizes="150px" />
                  : <div className="text-center"><div className="text-2xl mb-1">{icon}</div><p className="text-slate-500 text-xs">اضغط لاختيار</p></div>
                }
              </div>
              <input type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { setter(f); readPreview(f, prevSetter) }
                }} />
            </label>
          </div>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button onClick={submit} disabled={!selfie || !idDoc || loading}
        className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-40"
        style={{ background: !selfie || !idDoc || loading ? undefined : 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>
        {loading ? 'جاري الرفع...' : 'إرسال للمراجعة →'}
      </button>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function DoctorVerificationPanel() {
  const [state,   setState]   = useState<string>('UNVERIFIED')
  const [view,    setView]    = useState<PanelView>('status')
  const [loading, setLoading] = useState(true)
  const [rejReason, setRejReason] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const res  = await fetch('/api/doctor/verification-status')
      const data = await res.json()
      const s    = data.data?.verificationStatus ?? 'UNVERIFIED'
      setState(s)
      setRejReason(data.data?.rejectionReason ?? null)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  // تحديد الـ view المناسب تلقائياً حسب الحالة
  useEffect(() => {
    if (state === 'UNVERIFIED' || state === 'REVERIFY_REQUIRED')  setView('license')
    else if (state === 'LICENSE_UPLOADED')                         setView('credentials')
    else if (state === 'CREDENTIALS_UPLOADED')                     setView('face')
    else                                                            setView('status')
  }, [state])

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  // APPROVED
  if (state === 'APPROVED') return (
    <div className="rounded-2xl p-8 text-center"
      style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
      <div className="text-5xl mb-3">✅</div>
      <h3 className="text-emerald-400 text-xl font-bold mb-2">طبيب موثق</h3>
      <p className="text-slate-400 text-sm">تم التحقق من هويتك الطبية بنجاح. يمكنك الآن استقبال المرضى بدون قيود.</p>
    </div>
  )

  // ADMIN_REVIEW / FRAUD_CHECK / SCORING / FACE_SUBMITTED
  if (['ADMIN_REVIEW','PENDING_HUMAN','FRAUD_CHECK','SCORING','FACE_SUBMITTED'].includes(state)) return (
    <div className="space-y-4">
      <ProgressBar state={state} />
      <div className="rounded-2xl p-6 text-center"
        style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <div className="text-4xl mb-3">⏳</div>
        <h3 className="text-amber-400 text-lg font-bold mb-2">طلبك قيد المراجعة</h3>
        <p className="text-slate-400 text-sm leading-relaxed">
          طلبك وصل لفريق المراجعة البشرية. عادةً يستغرق 1-3 أيام عمل.
          ستصلك إشعار فور اتخاذ القرار.
        </p>
      </div>
    </div>
  )

  // REJECTED
  if (state === 'REJECTED') return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 text-center"
        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
        <div className="text-4xl mb-2">❌</div>
        <h3 className="text-red-400 text-lg font-bold mb-1">تم رفض الطلب</h3>
        {rejReason && <p className="text-slate-300 text-sm mt-2 p-3 rounded-xl bg-white/5">سبب الرفض: {rejReason}</p>}
      </div>
      <button onClick={() => { setState('REVERIFY_REQUIRED'); setView('license') }}
        className="w-full py-3 rounded-xl font-semibold text-white"
        style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
        إعادة التقديم
      </button>
    </div>
  )

  // Active steps: redirect to full 5-step verify flow
  if (['UNVERIFIED', 'PENDING_AI', 'REVERIFY_REQUIRED'].includes(state)) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl p-6 text-center mpi-card">
          <div className="text-4xl mb-3">🔐</div>
          <h3 className="text-white text-lg font-bold mb-2">التحقق من الهوية الطبية</h3>
          <p className="text-slate-400 text-sm mb-5 leading-relaxed">
            يتطلب 5 مستندات: الشهادة الجامعية، رخصة المزاولة، Dataflow، الهوية، والسيلفي.
          </p>
          <a href="/doctor/verify"
            className="inline-block w-full py-3 rounded-xl bg-primary hover:bg-primary-400 text-white font-semibold text-sm transition-all shadow-glow-primary">
            ابدأ رفع المستندات →
          </a>
        </div>
      </div>
    )
  }

  // Legacy 3-step uploads (in progress)
  return (
    <div className="space-y-4">
      <ProgressBar state={state} />

      {/* Step indicator */}
      <div className="rounded-xl px-4 py-3 text-sm"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {view === 'license'     && <span className="text-amber-400">الخطوة 1 من 3 — ارفع رخصة المزاولة</span>}
        {view === 'credentials' && <span className="text-purple-400">الخطوة 2 من 3 — ارفع شهاداتك العلمية</span>}
        {view === 'face'        && <span className="text-blue-400">الخطوة 3 من 3 — التحقق من الهوية</span>}
      </div>

      {view === 'license'     && <LicenseUpload     onDone={() => { loadStatus() }} />}
      {view === 'credentials' && <CredentialsUpload onDone={() => { loadStatus() }} />}
      {view === 'face'        && <FaceUpload        onDone={() => { loadStatus() }} />}
    </div>
  )
}
