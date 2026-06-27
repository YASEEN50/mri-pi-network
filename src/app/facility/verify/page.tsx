'use client'

// src/app/facility/verify/page.tsx — رفع أوراق الملكية والتصريح الرسمي



import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Role } from '@prisma/client'
import { useRequireAuth } from '@/hooks/useRequireAuth'

import Image from 'next/image'

import Link from 'next/link'

import Navbar from '@/components/common/Navbar'



type Step = 'ownership' | 'license' | 'done'



function FileDrop({

  preview, onPick, icon, label,

}: {

  preview: string; onPick: (f: File) => void; icon: string; label: string

}) {

  const ref = useRef<HTMLInputElement>(null)

  return (

    <div onClick={() => ref.current?.click()}

      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${preview ? 'border-accent/50' : 'border-white/15'}`}>

      {preview

        ? <div>

            <Image src={preview} alt="" width={400} height={200} unoptimized

              className="max-h-48 mx-auto rounded-xl object-contain mb-2" />

            <p className="text-accent text-sm">✅ تم الاختيار — اضغط للتغيير</p>

          </div>

        : <div>

            <div className="text-4xl mb-2">{icon}</div>

            <p className="text-slate-300 font-medium">{label}</p>

            <p className="text-slate-500 text-xs mt-1">PNG, JPG, PDF — حد 10MB</p>

          </div>

      }

      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden"

        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f) }} />

    </div>

  )

}



export default function FacilityVerifyPage() {
  const { session, isLoading } = useRequireAuth({ roles: [Role.FACILITY], onRoleMismatch: '/' })
  const router = useRouter()

  const [step, setStep] = useState<Step>('ownership')

  const [file, setFile] = useState<File | null>(null)

  const [preview, setPreview] = useState('')

  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(true)

  const [error, setError] = useState('')
  const [hasOwnership, setHasOwnership] = useState(false)
  const [hasLicense, setHasLicense] = useState(false)



  useEffect(() => {
    if (isLoading || !session?.user) return
    if (session.user.approvalStatus === 'APPROVED') {
      router.push('/dashboard/facility/doctors')
    }
  }, [isLoading, session, router])

  useEffect(() => {
    if (isLoading || !session?.user) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/facility/upload-document')
        const data = await res.json()
        if (cancelled || !res.ok || !data.success) return
        setHasOwnership(Boolean(data.hasOwnership))
        setHasLicense(Boolean(data.hasLicense))
        if (data.readyForReview) setStep('done')
        else if (data.hasOwnership) setStep('license')
        else setStep('ownership')
      } catch {
        /* keep default step */
      } finally {
        if (!cancelled) setStatusLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isLoading, session])



  function pickFile(f: File) {

    if (f.size > 10 * 1024 * 1024) { setError('الحجم الأقصى 10MB'); return }

    setError('')

    setFile(f)

    const r = new FileReader()

    r.onload = e => setPreview(e.target?.result as string)

    r.readAsDataURL(f)

  }



  async function upload(docType: 'OWNERSHIP' | 'LICENSE') {

    if (!file) { setError('اختر ملفاً أولاً'); return }

    setLoading(true); setError('')

    const fd = new FormData()

    fd.append('docType', docType)

    fd.append('file', file)

    try {

      const res = await fetch('/api/facility/upload-document', { method: 'POST', body: fd })

      const data = await res.json()

      if (data.error || !data.success) {
        setError(
          data.message ??
            (typeof data.error === 'object' && data.error?.message ? data.error.message : null) ??
            'حدث خطأ',
        )
        return
      }

      setFile(null); setPreview('')

      if (docType === 'OWNERSHIP') {
        setHasOwnership(true)
        setStep('license')
      } else {
        setHasLicense(true)
      }

      if (docType === 'LICENSE' && data.readyForReview) {

        setStep('done')

        setTimeout(() => router.push('/facility/pending'), 1500)

      } else if (docType === 'LICENSE') setStep('done')

    } catch { setError('خطأ في الاتصال') }

    finally { setLoading(false) }

  }



  if (isLoading || statusLoading) return (

    <div className="min-h-screen bg-background flex items-center justify-center">

      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />

    </div>

  )



  return (

    <div className="min-h-screen bg-background" dir="rtl">

      <Navbar locale="ar" />

      <div className="max-w-lg mx-auto px-4 py-10">

        <div className="text-center mb-8">

          <div className="text-4xl mb-2">🏥</div>

          <h1 className="text-2xl font-bold text-white">مستندات المنشأة</h1>

          <p className="text-slate-400 text-sm mt-1">ارفع أوراق الملكية والتصريح الرسمي للمراجعة</p>

        </div>



        <div className="flex justify-center gap-4 mb-8">

          {[

            { key: 'ownership', label: 'أوراق الملكية', icon: '🏠' },

            { key: 'license', label: 'التصريح الرسمي', icon: '📋' },

          ].map((s, i) => (

            <div key={s.key} className="flex items-center gap-2">

              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm border-2

                ${step === s.key ? 'border-accent text-accent bg-primary/20' :

                  step === 'done' || (step === 'license' && s.key === 'ownership')

                    ? 'border-primary bg-primary text-white' : 'border-white/10 text-slate-500'}`}>

                {step === 'done' || (step === 'license' && s.key === 'ownership') ? '✓' : s.icon}

              </div>

              <span className="text-xs text-slate-400 hidden sm:block">{s.label}</span>

              {i === 0 && <div className="w-8 h-0.5 bg-white/10" />}

            </div>

          ))}

        </div>



        {(hasOwnership || hasLicense) && step !== 'done' && (
          <div className="mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-slate-400">
            {hasOwnership ? '✅ أوراق الملكية مرفوعة' : '⏳ أوراق الملكية مطلوبة'}
            {' · '}
            {hasLicense ? '✅ التصريح مرفوع' : '⏳ التصريح مطلوب'}
          </div>
        )}

        <div className="mpi-card rounded-2xl p-6 space-y-5">

          {step === 'done' ? (

            <div className="text-center py-6">

              <div className="text-5xl mb-3">✅</div>

              <p className="text-white font-semibold">تم رفع جميع المستندات</p>

              <p className="text-slate-400 text-sm mt-2">سيتم مراجعتها خلال 1-3 أيام عمل</p>

              <Link href="/facility/pending" className="inline-block mt-4 text-accent text-sm hover:underline">

                متابعة حالة الطلب →

              </Link>

            </div>

          ) : step === 'ownership' ? (

            <>

              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">

                <p className="text-accent font-medium text-sm">🏠 أوراق الملكية أو عقد الإيجار</p>

                <p className="text-slate-400 text-xs mt-1">صك ملكية أو عقد إيجار ساري للمنشأة</p>

              </div>

              <FileDrop preview={preview} onPick={pickFile} icon="🏠" label="ارفع صك الملكية أو عقد الإيجار" />

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button onClick={() => upload('OWNERSHIP')} disabled={loading || !file}

                className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 bg-primary hover:bg-primary-600 transition-all shadow-glow-primary">

                {loading ? 'جاري الرفع...' : 'رفع والمتابعة →'}

              </button>

            </>

          ) : (

            <>

              <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">

                <p className="text-accent font-medium text-sm">📋 التصريح / الترخيص الرسمي</p>

                <p className="text-slate-400 text-xs mt-1">ترخيص مزاولة من الجهة المختصة (وزارة الصحة / الهيئة)</p>

              </div>

              <FileDrop preview={preview} onPick={pickFile} icon="📋" label="ارفع التصريح أو الترخيص الرسمي" />

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button onClick={() => upload('LICENSE')} disabled={loading || !file}

                className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 bg-gradient-to-br from-primary to-primary-700 hover:opacity-90 transition-all">

                {loading ? 'جاري الرفع...' : '✅ إرسال للمراجعة'}

              </button>

            </>

          )}

        </div>

      </div>

    </div>

  )

}


