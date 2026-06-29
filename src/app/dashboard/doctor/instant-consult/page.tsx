'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DoctorSubpageLayout from '@/components/doctor/DoctorSubpageLayout'
import { INSTANT_CONSULT_ACCEPT_TIMEOUT_SEC } from '@/lib/instant-consult/constants'

interface Settings {
  acceptsInstantConsult: boolean
  isOnlineForInstant: boolean
  instantConsultFee: number | null
  instantConsultDurationMinutes: number
}

interface IncomingRequest {
  id: string
  status: string
  reason: string | null
  fee: number
  expiresAt: string | null
  isBroadcast?: boolean
  targetSpecialization?: string | null
  client: { name: string }
}

export default function DoctorInstantConsultPage() {
  const { status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [incoming, setIncoming] = useState<IncomingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const [setRes, reqRes] = await Promise.all([
        fetch('/api/doctor/instant-consult'),
        fetch('/api/instant-consult'),
      ])
      const [setData, reqData] = await Promise.all([setRes.json(), reqRes.json()])
      if (setData.data) setSettings(setData.data)
      setIncoming(reqData.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(timer)
  }, [load])

  async function toggleOnline() {
    if (!settings) return
    const goingOnline = !settings.isOnlineForInstant
    if (goingOnline && (!settings.instantConsultFee || settings.instantConsultFee <= 0)) {
      setMessage('⚠️ حدّد رسوم الاستشارة (π) ثم احفظ قبل التفعيل')
      return
    }
    setSaving(true)
    setMessage('')
    const patch = goingOnline
      ? { isOnlineForInstant: true, acceptsInstantConsult: true }
      : { isOnlineForInstant: false }
    const res = await fetch('/api/doctor/instant-consult', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (data.success) {
      setSettings(data.data)
      setMessage(goingOnline ? 'أنت متاح الآن — سيظهر اسمك للمرضى ✅' : 'تم إيقاف التوفر')
    }
    setSaving(false)
  }

  async function saveSettings(patch: Partial<Settings>) {
    if (!settings) return
    setSaving(true)
    setMessage('')
    const res = await fetch('/api/doctor/instant-consult', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (data.success) {
      setSettings(data.data)
      setMessage('تم الحفظ ✅')
    }
    setSaving(false)
  }

  async function acceptRequest(id: string) {
    setMessage('')
    const res = await fetch(`/api/instant-consult/${id}/accept`, { method: 'POST' })
    const data = await res.json()
    if (!data.success || data.data?.error) {
      setMessage(`❌ ${data.data?.message ?? data.error?.message ?? 'فشل قبول الطلب'}`)
      await load()
      return
    }
    if (data.data?.chatRoomId) {
      router.push(`/dashboard/doctor/chat?room=${data.data.chatRoomId}`)
      return
    }
    setMessage('✅ تم قبول الطلب')
    await load()
  }

  async function rejectRequest(id: string) {
    setMessage('')
    const res = await fetch(`/api/instant-consult/${id}/reject`, { method: 'POST' })
    const data = await res.json()
    if (!data.success || data.data?.error) {
      setMessage(`❌ ${data.data?.message ?? 'فشل رفض الطلب'}`)
    } else {
      setMessage('تم رفض الطلب')
    }
    await load()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <DoctorSubpageLayout title="⚡ الاستشارة الفورية" subtitle="استقبل طلبات المرضى العاجلة غير الطارئة">
      {message && (
        <p className={`mb-4 text-sm ${message.startsWith('❌') ? 'text-red-400' : 'text-emerald-400'}`}>
          {message}
        </p>
      )}

      {settings && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-medium">متاح الآن للاستشارة الفورية</p>
              <p className="text-slate-500 text-xs">عند التفعيل يظهر اسمك في /consult-now (لا يشترط البريميو)</p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void toggleOnline()}
              className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                settings.isOnlineForInstant
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-white/10 bg-white/5 text-slate-400'
              }`}
            >
              {settings.isOnlineForInstant ? '🟢 متاح' : '⚫ غير متاح'}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1">رسوم الاستشارة (π)</label>
              <input
                type="number"
                step="0.0001"
                value={settings.instantConsultFee ?? ''}
                onChange={(e) =>
                  setSettings((s) =>
                    s ? { ...s, instantConsultFee: parseFloat(e.target.value) || null } : s,
                  )
                }
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">مدة الجلسة (دقيقة)</label>
              <input
                type="number"
                min={5}
                max={60}
                value={settings.instantConsultDurationMinutes}
                onChange={(e) =>
                  setSettings((s) =>
                    s ? { ...s, instantConsultDurationMinutes: parseInt(e.target.value) || 15 } : s,
                  )
                }
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void saveSettings({
                acceptsInstantConsult: true,
                instantConsultFee: settings.instantConsultFee ?? undefined,
                instantConsultDurationMinutes: settings.instantConsultDurationMinutes,
              })
            }
            className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium disabled:opacity-50"
          >
            حفظ الإعدادات
          </button>
        </div>
      )}

      <h2 className="text-white font-semibold mb-3">طلبات واردة</h2>
      <p className="text-slate-500 text-xs mb-4">
        لديك {INSTANT_CONSULT_ACCEPT_TIMEOUT_SEC} ثانية للقبول بعد دفع المريض
      </p>

      {incoming.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">لا توجد طلبات حالياً</p>
      ) : (
        <div className="space-y-3">
          {incoming.map((r) => (
            <div
              key={r.id}
              className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25"
            >
              <p className="text-white font-medium">{r.client.name}</p>
              {r.isBroadcast && (
                <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  📡 بث — {r.targetSpecialization ?? 'تخصص عام'}
                </span>
              )}
              {r.reason && <p className="text-slate-400 text-sm mt-1">{r.reason}</p>}
              <p className="text-purple-300 text-xs mt-1">{r.fee} π</p>
              {r.status === 'PENDING' && (
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => void acceptRequest(r.id)}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
                  >
                    ✅ قبول
                  </button>
                  <button
                    type="button"
                    onClick={() => void rejectRequest(r.id)}
                    className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm"
                  >
                    رفض
                  </button>
                </div>
              )}
              {r.status === 'ACCEPTED' && r.expiresAt && (
                <Link
                  href="/dashboard/doctor/chat"
                  className="inline-block mt-3 text-emerald-400 text-sm hover:underline"
                >
                  متابعة المحادثة →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </DoctorSubpageLayout>
  )
}
