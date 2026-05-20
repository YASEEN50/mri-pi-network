'use client'
// src/app/doctor/verify/page.tsx
// نظام التحقق الإلزامي — server-side OCR + file upload

import { useState, useEffect, useRef } from 'react'
import { useSession }  from 'next-auth/react'
import { useRouter }   from 'next/navigation'
import Image           from 'next/image'
import Link            from 'next/link'
import Navbar          from '@/components/common/Navbar'

// Device fingerprint بسيط من browser signals
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
    // hash بسيط
    let h = 0
    for (let i = 0; i < raw.length; i++) {
      h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0
    }
    did = Math.abs(h).toString(36) + Date.now().toString(36)
    try { localStorage.setItem(key, did) } catch {}
  }
  return did
}

type Stage = 'license' | 'credentials' | 'face' | 'submitted'

const STAGES = [
  { key: 'license',     label: 'رخصة المزاولة',    icon: '📋' },
  { key: 'credentials', label: 'الشهادات',          icon: '🎓' },
  { key: 'face',        label: 'التحقق من الهوية',  icon: '🪪' },
  { key: 'submitted',   label: 'قيد المراجعة',      icon: '✅' },
]

// ─── Step Bar ──────────────────────────────────────────────────────────────────
function StepBar({ stage }: { stage: Stage }) {
  const idx = STAGES.findIndex(s => s.key === stage)
  return (
    <div className="flex items-center justify-center mb-8">
      {STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm border-2 transition-all
              ${i < idx  ? 'bg-emerald-500 border-emerald-500 text-white' :
                i === idx ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400' :
                'bg-white/5 border-white/10 text-slate-500'}`}>
              {i < idx ? '✓' : s.icon}
            </div>
            <span className={`text-xs w-16 text-center leading-tight ${
              i === idx ? 'text-emerald-400' : i < idx ? 'text-emerald-600' : 'text-slate-600'}`}>
              {s.label}
            </span>
          </div>
          {i < STAGES.length - 1 && (
            <div className={`w-10 h-0.5 mb-5 mx-1 transition-all ${i < idx ? 'bg-emerald-500' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── المرحلة 1: رخصة المزاولة ─────────────────────────────────────────────────
function LicenseStage({ onDone }: { onDone: () => void }) {
  const [file,    setFile]    = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [jobId,   setJobId]   = useState('')
  const [polling, setPolling] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef  = useRef<any>(null)

  async function pickFile(f: File) {
    if (f.size > 10 * 1024 * 1024) { setError('الحجم الأقصى 10MB'); return }
    setError('')
    setLoading(true)
    try {
      const { compressImageForUpload } = await import('@/lib/client/image-compress')
      const compressed = await compressImageForUpload(f)
      setFile(compressed)
      const r = new FileReader()
      r.onload = e => setPreview(e.target?.result as string)
      r.readAsDataURL(compressed)
    } catch {
      setFile(f)
      const r = new FileReader()
      r.onload = e => setPreview(e.target?.result as string)
      r.readAsDataURL(f)
    } finally {
      setLoading(false)
    }
  }

  // polling لحالة OCR job
  function startPolling(jId: string) {
    setPolling(true)
    let tries = 0
    pollRef.current = setInterval(async () => {
      tries++
      if (tries > 24) { // max 2 minutes
        clearInterval(pollRef.current)
        setPolling(false)
        setError('انتهت مهلة المعالجة. جرب مجدداً.')
        return
      }
      try {
        const res  = await fetch('/api/doctor/verification-status')
        const data = await res.json()
        const state = data.data?.verificationStatus
        if (state && state !== 'UNVERIFIED') {
          clearInterval(pollRef.current)
          setPolling(false)
          onDone()
        }
        // تحقق من حالة الـ job
        const jobs = data.data?.jobs ?? []
        const job  = jobs.find((j: any) => j.id === jId)
        if (job?.status === 'completed') {
          clearInterval(pollRef.current)
          setPolling(false)
          onDone()
        } else if (job?.status === 'failed' || job?.status === 'dead') {
          clearInterval(pollRef.current)
          setPolling(false)
          // حتى لو فشل OCR، ننتقل للخطوة التالية (الـ session تُحدَّث يدوياً)
          onDone()
        }
      } catch {}
    }, 5000)
  }

  useEffect(() => () => clearInterval(pollRef.current), [])

  async function submit() {
    if (!file) { setError('يرجى اختيار صورة رخصة المزاولة'); return }
    setLoading(true); setError('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res  = await fetch('/api/doctor/upload-license', {
        method: 'POST',
        headers: {
          'x-idempotency-key': crypto.randomUUID(),
          'x-device-id': getDeviceId(),
        },
        body: formData,
      })
      const data = await res.json()

      if (data.error || data.data?.error) {
        setError(data.message ?? data.data?.message ?? 'حدث خطأ')
        return
      }

      const jId = data.jobId ?? data.data?.jobId
      if (jId) {
        setJobId(jId)
        startPolling(jId)
      } else {
        // لا يوجد job — انتقل مباشرة
        onDone()
      }

    } catch { setError('خطأ في الاتصال') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl" style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)'}}>
        <p className="text-amber-400 font-semibold text-sm mb-1">⚠️ مطلوب: رخصة مزاولة المهنة</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          ارفع صورة واضحة لرخصة مزاولة المهنة الصادرة من الهيئة السعودية للتخصصات الصحية.
          يجب أن تظهر: الاسم — التخصص — رقم الترخيص — تاريخ الانتهاء.
          سيتم استخراج البيانات تلقائياً على السيرفر.
        </p>
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-2 font-medium">
          صورة رخصة المزاولة <span className="text-red-400">*</span>
        </label>
        <div onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) pickFile(f) }}
          className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all"
          style={{borderColor: preview ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.15)'}}>
          {preview
            ? <div><Image src={preview} alt="" width={400} height={192} unoptimized className="max-h-48 mx-auto rounded-xl object-contain mb-2"/>
                <p className="text-emerald-400 text-sm">✅ تم اختيار الصورة — اضغط للتغيير</p></div>
            : <div><div className="text-4xl mb-2">📋</div>
                <p className="text-slate-300 font-medium">اسحب الصورة هنا أو اضغط للاختيار</p>
                <p className="text-slate-500 text-xs mt-1">PNG, JPG, PDF — حد 10MB</p></div>
          }
          <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />
        </div>
      </div>

      {polling && (
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.2)'}}>
          <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0" />
          <div>
            <p className="text-blue-400 text-sm font-medium">جاري معالجة الصورة على السيرفر...</p>
            <p className="text-slate-500 text-xs mt-0.5">استخراج البيانات من الرخصة — قد يستغرق 30-60 ثانية</p>
          </div>
        </div>
      )}

      {error && <div className="px-4 py-3 rounded-xl text-sm" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171'}}>{error}</div>}

      <button onClick={submit} disabled={loading || polling || !file}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-all"
        style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)'}}>
        {loading ? 'جاري الرفع...' : polling ? 'جاري معالجة OCR...' : 'رفع الرخصة والمتابعة →'}
      </button>
    </div>
  )
}

// ─── المرحلة 2: الشهادات العلمية ─────────────────────────────────────────────
function CredentialsStage({ onDone }: { onDone: () => void }) {
  interface CertEntry { title: string; file: File | null; preview: string; uploaded: boolean }
  const [certs,   setCerts]   = useState<CertEntry[]>([{ title: '', file: null, preview: '', uploaded: false }])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function addCert() { setCerts(p => [...p, { title: '', file: null, preview: '', uploaded: false }]) }
  function removeCert(i: number) { setCerts(p => p.filter((_, idx) => idx !== i)) }

  function pickFile(i: number, f: File) {
    const r = new FileReader()
    r.onload = e => setCerts(p => p.map((c, idx) => idx === i ? { ...c, file: f, preview: e.target?.result as string } : c))
    r.readAsDataURL(f)
  }

  async function submit() {
    const toUpload = certs.filter(c => c.file && c.title.trim())
    if (toUpload.length === 0) { setError('أضف شهادة واحدة على الأقل مع صورتها وعنوانها'); return }

    setLoading(true); setError('')
    try {
      // رفع كل شهادة
      for (const cert of toUpload) {
        const fd = new FormData()
        fd.append('file',  cert.file!)
        fd.append('title', cert.title)
        const res  = await fetch('/api/doctor/upload-credentials', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.error || data.data?.error) {
          setError(data.message ?? data.data?.message ?? 'فشل رفع إحدى الشهادات')
          return
        }
      }
      onDone()
    } catch { setError('خطأ في الاتصال') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl" style={{background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.2)'}}>
        <p className="text-indigo-400 font-semibold text-sm mb-1">🎓 الشهادات والمؤهلات العلمية</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          ارفع صور شهاداتك الجامعية والتخصصية. كل شهادة تحتاج عنواناً وصورة واضحة.
          ستراجعها إدارة المنصة للتحقق من صحتها.
        </p>
      </div>

      {certs.map((c, i) => (
        <div key={i} className="rounded-xl p-4 space-y-3" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
          <div className="flex items-center justify-between">
            <span className="text-indigo-400 text-sm font-medium">شهادة {i + 1}</span>
            {certs.length > 1 && (
              <button onClick={() => removeCert(i)} className="text-red-400/60 hover:text-red-400 text-xs transition-colors">🗑 حذف</button>
            )}
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">عنوان الشهادة <span className="text-red-400">*</span></label>
            <input value={c.title} onChange={e => setCerts(p => p.map((x,idx) => idx===i ? {...x,title:e.target.value} : x))}
              placeholder="مثال: بكالوريوس طب وجراحة — جامعة الملك سعود — 2015"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">صورة الشهادة <span className="text-red-400">*</span></label>
            <div onClick={() => refs.current[i]?.click()}
              className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all"
              style={{borderColor: c.preview ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.12)'}}>
              {c.preview
                ? <div><Image src={c.preview} alt="" width={320} height={112} unoptimized className="max-h-28 mx-auto rounded-lg object-contain mb-1"/>
                    <p className="text-indigo-400 text-xs">✅ تم الاختيار — اضغط للتغيير</p></div>
                : <div><div className="text-2xl mb-1">📄</div><p className="text-slate-500 text-xs">اضغط لاختيار صورة الشهادة</p></div>
              }
              <input ref={el => { refs.current[i] = el }} type="file" accept="image/*,.pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(i, f) }} />
            </div>
          </div>
        </div>
      ))}

      <button onClick={addCert}
        className="w-full py-2.5 rounded-xl text-sm font-medium border-2 border-dashed transition-all"
        style={{borderColor:'rgba(99,102,241,0.3)',color:'#818cf8',background:'rgba(99,102,241,0.05)'}}>
        + إضافة شهادة أخرى
      </button>

      {error && <div className="px-4 py-3 rounded-xl text-sm" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171'}}>{error}</div>}

      <button onClick={submit} disabled={loading}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-all"
        style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
        {loading ? 'جاري الرفع...' : 'رفع الشهادات والمتابعة →'}
      </button>
    </div>
  )
}

// ─── المرحلة 3: التحقق من الهوية ─────────────────────────────────────────────
function FaceStage({ onDone }: { onDone: () => void }) {
  const [selfie,  setSelfie]  = useState<File | null>(null)
  const [idDoc,   setIdDoc]   = useState<File | null>(null)
  const [selfieP, setSelfieP] = useState('')
  const [idDocP,  setIdDocP]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const selfieRef = useRef<HTMLInputElement>(null)
  const idRef     = useRef<HTMLInputElement>(null)

  function readPreview(f: File, setter: (s: string) => void) {
    const r = new FileReader()
    r.onload = e => setter(e.target?.result as string)
    r.readAsDataURL(f)
  }

  const [polling,  setPolling]  = useState(false)
  const pollRef2 = useRef<any>(null)

  function startFacePolling() {
    setPolling(true)
    let tries = 0
    pollRef2.current = setInterval(async () => {
      tries++
      if (tries > 24) {
        clearInterval(pollRef2.current); setPolling(false)
        onDone(); return
      }
      try {
        const res  = await fetch('/api/doctor/verification-status')
        const data = await res.json()
        const state = data.data?.verificationStatus
        if (['PENDING_HUMAN', 'ADMIN_REVIEW', 'APPROVED'].includes(state)) {
          clearInterval(pollRef2.current); setPolling(false); onDone()
        }
        const jobs = data.data?.jobs ?? []
        const faceJob = jobs.find((j: any) => j.jobType === 'face-comparison')
        if (faceJob?.status === 'completed' || faceJob?.status === 'dead' || faceJob?.status === 'failed') {
          clearInterval(pollRef2.current); setPolling(false); onDone()
        }
      } catch {}
    }, 5000)
  }

  useEffect(() => () => clearInterval(pollRef2.current), [])

  async function submit() {
    if (!selfie) { setError('الصورة الشخصية مطلوبة'); return }
    if (!idDoc)  { setError('صورة الوثيقة الرسمية مطلوبة'); return }
    setLoading(true); setError('')

    const fd = new FormData()
    fd.append('selfie',     selfie)
    fd.append('idDocument', idDoc)

    try {
      const res  = await fetch('/api/doctor/upload-face-v2', {
        method: 'POST',
        headers: { 'x-device-id': getDeviceId() },
        body: fd,
      })
      const data = await res.json()
      if (data.error || data.data?.error) {
        setError(data.message ?? data.data?.message ?? 'حدث خطأ')
        return
      }
      startFacePolling()
    } catch { setError('خطأ في الاتصال') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl" style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)'}}>
        <p className="text-emerald-400 font-semibold text-sm mb-1">🪪 التحقق من هوية الطبيب</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          نحتاج التأكد من أنك صاحب الرخصة الطبية.
          ارفع صورة شخصية واضحة + صورة وثيقة رسمية (هوية/جواز/إقامة) تحتوي على صورتك.
          <span className="text-amber-400 font-medium"> المراجعة البشرية إلزامية بغض النظر عن أي نتيجة تلقائية.</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* الصورة الشخصية */}
        <div>
          <p className="text-slate-300 text-sm font-medium mb-1">صورة شخصية <span className="text-red-400">*</span></p>
          <p className="text-slate-500 text-xs mb-2">وجهك ظاهر بوضوح — إضاءة جيدة</p>
          <div onClick={() => selfieRef.current?.click()}
            className="relative aspect-square border-2 border-dashed rounded-xl overflow-hidden cursor-pointer flex items-center justify-center transition-all"
            style={{borderColor: selfieP ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.15)'}}>
            {selfieP
              ? <Image src={selfieP} alt="" fill unoptimized className="object-cover" sizes="(max-width: 768px) 50vw, 200px" />
              : <div className="text-center p-3"><div className="text-3xl mb-1">🤳</div><p className="text-slate-500 text-xs">صورة شخصية</p></div>
            }
          </div>
          <input ref={selfieRef} type="file" accept="image/*" capture="user" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { setSelfie(f); readPreview(f, setSelfieP) } }} />
          {selfieP && <button onClick={() => selfieRef.current?.click()} className="text-xs text-blue-400 mt-1">تغيير</button>}
        </div>

        {/* الوثيقة */}
        <div>
          <p className="text-slate-300 text-sm font-medium mb-1">وثيقة رسمية <span className="text-red-400">*</span></p>
          <p className="text-slate-500 text-xs mb-2">هوية / جواز / إقامة</p>
          <div onClick={() => idRef.current?.click()}
            className="relative aspect-square border-2 border-dashed rounded-xl overflow-hidden cursor-pointer flex items-center justify-center transition-all"
            style={{borderColor: idDocP ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.15)'}}>
            {idDocP
              ? <Image src={idDocP} alt="" fill unoptimized className="object-cover" sizes="(max-width: 768px) 50vw, 200px" />
              : <div className="text-center p-3"><div className="text-3xl mb-1">🪪</div><p className="text-slate-500 text-xs">هوية / جواز</p></div>
            }
          </div>
          <input ref={idRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { setIdDoc(f); readPreview(f, setIdDocP) } }} />
          {idDocP && <button onClick={() => idRef.current?.click()} className="text-xs text-blue-400 mt-1">تغيير</button>}
        </div>
      </div>

      {selfie && idDoc && (
        <div className="p-3 rounded-xl text-xs" style={{background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.15)',color:'#64748b'}}>
          ✅ كلا الصورتين جاهزتان للرفع — ستُراجعان من الفريق المتخصص
        </div>
      )}

      {error && <div className="px-4 py-3 rounded-xl text-sm" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171'}}>{error}</div>}

      {polling && (
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)'}}>
          <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full flex-shrink-0" />
          <div>
            <p className="text-emerald-400 text-sm font-medium">جاري مقارنة الوجه على السيرفر...</p>
            <p className="text-slate-500 text-xs mt-0.5">قد يستغرق 10-30 ثانية — ستُرسل للمراجعة البشرية بعدها</p>
          </div>
        </div>
      )}

      <button onClick={submit} disabled={loading || polling || !selfie || !idDoc}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-all"
        style={{background:'linear-gradient(135deg,#10b981,#0891b2)'}}>
        {loading ? 'جاري الرفع...' : polling ? 'جاري المقارنة...' : '✅ إرسال للمراجعة البشرية الإلزامية'}
      </button>
      <p className="text-slate-500 text-xs text-center">🔒 صورك محفوظة بأمان وتُستخدم لأغراض التحقق فقط</p>
    </div>
  )
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────────────────────
export default function DoctorVerifyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stage,   setStage]   = useState<Stage>('license')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') {
      if (session?.user?.role !== 'DOCTOR') { router.push('/unauthorized'); return }
      if (session?.user?.approvalStatus === 'APPROVED') { router.push('/dashboard/doctor/schedule'); return }

      fetch('/api/doctor/verification-status')
        .then(r => r.json())
        .then(d => {
          const state = d.data?.verificationStatus
          if (!state || state === 'UNVERIFIED' || state === 'PENDING_AI') setStage('license')
          else if (state === 'LICENSE_UPLOADED')             setStage('credentials')
          else if (state === 'CREDENTIALS_UPLOADED')         setStage('face')
          else if (['FACE_SUBMITTED','FRAUD_CHECK','SCORING','PENDING_HUMAN','ADMIN_REVIEW'].includes(state))
                                                             setStage('submitted')
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [status, session, router])

  if (status === 'loading' || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#080c14'}}>
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="min-h-screen" style={{background:'#080c14'}} dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔐</div>
          <h1 className="text-2xl font-bold text-white">التحقق من هوية الطبيب</h1>
          <p className="text-slate-400 text-sm mt-1">خطوة إلزامية لحماية سلامة المرضى</p>
        </div>

        <StepBar stage={stage} />

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
          {stage === 'license'     && <LicenseStage     onDone={() => setStage('credentials')} />}
          {stage === 'credentials' && <CredentialsStage onDone={() => setStage('face')} />}
          {stage === 'face'        && <FaceStage        onDone={() => setStage('submitted')} />}
          {stage === 'submitted'   && (
            <div className="text-center py-6 space-y-4">
              <div className="text-5xl">⏳</div>
              <h2 className="text-xl font-bold text-white">طلبك قيد المراجعة البشرية</h2>
              <div className="space-y-3 text-right">
                {[
                  { icon:'✅', color:'#10b981', title:'تم استلام جميع المستندات', desc:'رخصة المزاولة، الشهادات، وصور التحقق من الهوية' },
                  { icon:'👨‍💼', color:'#3b82f6', title:'مراجعة بشرية إلزامية', desc:'يراجع فريقنا المتخصص كل مستند للتحقق من صحته وهويتك' },
                  { icon:'⏱',  color:'#f59e0b', title:'المدة المتوقعة: 1-3 أيام عمل', desc:'ستصلك إشعار فور اتخاذ القرار' },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl"
                    style={{background:`${item.color}10`,border:`1px solid ${item.color}20`}}>
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium" style={{color:item.color}}>{item.title}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/" className="inline-block mt-2 px-6 py-2.5 rounded-xl text-sm transition-all"
                style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#94a3b8'}}>
                العودة للرئيسية
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
