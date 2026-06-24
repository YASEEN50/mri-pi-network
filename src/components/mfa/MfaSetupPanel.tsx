'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'

type Step = 'idle' | 'scan' | 'confirm' | 'done'

export default function MfaSetupPanel() {
  const { update } = useSession()
  const [step, setStep] = useState<Step>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])

  async function startSetup() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/mfa/setup', { method: 'POST' })
      const json = await res.json()
      if (!json.success || json.data?.error) {
        setError(json.data?.message ?? json.error?.message ?? 'فشل بدء الإعداد')
        return
      }
      setQrDataUrl(json.data.qrDataUrl)
      setSecret(json.data.secret)
      setStep('scan')
    } catch {
      setError('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  async function confirmEnable() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/mfa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const json = await res.json()
      if (!json.success || json.data?.error) {
        setError(json.data?.message ?? 'رمز غير صحيح')
        return
      }
      setBackupCodes(json.data.backupCodes ?? [])
      setStep('done')
      await update({ mfaEnabled: true, mfaVerified: true })
    } catch {
      setError('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-emerald-400 font-medium">✅ تم تفعيل MFA بنجاح</p>
          <p className="text-slate-400 text-sm mt-2">
            احفظ رموز النسخ الاحتياطي في مكان آمن — لن تُعرض مرة أخرى.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-sm text-slate-300">
          {backupCodes.map(c => (
            <div key={c} className="rounded-lg bg-white/5 px-3 py-2 text-center">{c}</div>
          ))}
        </div>
        <a
          href={sessionRoleHome()}
          className="inline-block px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium"
        >
          متابعة →
        </a>
      </div>
    )
  }

  if (step === 'scan' || step === 'confirm') {
    return (
      <div className="space-y-4">
        <p className="text-slate-400 text-sm">
          امسح رمز QR بتطبيق Google Authenticator أو Authy، ثم أدخل الرمز المكوّن من 6 أرقام.
        </p>
        {qrDataUrl && (
          <div className="flex justify-center">
            <Image src={qrDataUrl} alt="MFA QR" width={220} height={220} unoptimized className="rounded-xl" />
          </div>
        )}
        {secret && (
          <p className="text-xs text-slate-500 break-all text-center" dir="ltr">
            Secret: {secret}
          </p>
        )}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          dir="ltr"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-center text-lg tracking-widest"
        />
        <button
          type="button"
          onClick={() => void confirmEnable()}
          disabled={loading || code.length < 6}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium"
        >
          {loading ? 'جاري التحقق...' : 'تفعيل MFA'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">
        المصادقة الثنائية (TOTP) إلزامية لحسابات الأدمن والمالك قبل الوصول للوحة الإدارة.
      </p>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="button"
        onClick={() => void startSetup()}
        disabled={loading}
        className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50"
      >
        {loading ? 'جاري التحضير...' : '🔐 بدء إعداد MFA'}
      </button>
    </div>
  )
}

function sessionRoleHome(): string {
  if (typeof window === 'undefined') return '/admin'
  return window.location.pathname.includes('/owner') ? '/owner' : '/admin'
}
