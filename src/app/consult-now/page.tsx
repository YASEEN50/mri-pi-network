'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/common/Navbar'
import { payForInstantConsult, piPaymentErrorMessage } from '@/lib/pi/pi-payment-client'
import { INSTANT_CONSULT_ACCEPT_TIMEOUT_SEC } from '@/lib/instant-consult/constants'

interface AvailableDoctor {
  id: string
  fullName: string
  specialization: string
  avatarUrl: string | null
  averageRating: number
  totalReviews: number
  fee: number
  durationMinutes: number
}

type Phase = 'browse' | 'waiting' | 'accepted' | 'failed'

export default function ConsultNowPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [payingDoctorId, setPayingDoctorId] = useState<string | null>(null)
  const [doctors, setDoctors] = useState<AvailableDoctor[]>([])
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  const [selected, setSelected] = useState<AvailableDoctor | null>(null)
  const [phase, setPhase] = useState<Phase>('browse')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [chatRoomId, setChatRoomId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(INSTANT_CONSULT_ACCEPT_TIMEOUT_SEC)

  const loadDoctors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/instant-consult/doctors')
      const data = await res.json()
      setDoctors(data.data ?? [])
    } catch {
      setError('تعذر تحميل الأطباء المتاحين')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDoctors()
  }, [loadDoctors])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login?redirect=/consult-now')
  }, [status, router])

  useEffect(() => {
    if (phase !== 'waiting' || !requestId) return

    const poll = async () => {
      const res = await fetch('/api/instant-consult')
      const data = await res.json()
      const req = (data.data ?? []).find((r: { id: string }) => r.id === requestId)
      if (req?.status === 'ACCEPTED' && req.chatRoomId) {
        setChatRoomId(req.chatRoomId)
        setPhase('accepted')
      } else if (req?.status === 'REJECTED' || req?.status === 'EXPIRED') {
        setPhase('failed')
        setError(
          req.status === 'EXPIRED'
            ? 'انتهت مهلة انتظار الطبيب — أُرجِع المبلغ إلى رصيدك في المنصة'
            : 'رفض الطبيب الطلب — أُرجِع المبلغ إلى رصيدك في المنصة',
        )
      }
    }

    void poll()
    const timer = window.setInterval(poll, 3000)
    return () => window.clearInterval(timer)
  }, [phase, requestId])

  useEffect(() => {
    if (phase !== 'waiting') return
    if (countdown <= 0) {
      setPhase('failed')
      setError('انتهت مهلة انتظار الطبيب')
      return
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [phase, countdown])

  async function startConsult(doctor: AvailableDoctor) {
    if (!session) {
      router.push('/login?redirect=/consult-now')
      return
    }
    setSelected(doctor)
    setError('')
    setPayingDoctorId(doctor.id)

    try {
      const res = await fetch('/api/instant-consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId: doctor.id, reason: reason || undefined }),
      })
      const data = await res.json()
      if (!data.success || data.data?.error) {
        setError(data.data?.message ?? 'تعذر إنشاء الطلب')
        setPhase('browse')
        setPayingDoctorId(null)
        return
      }

      const id = data.data.id as string
      setRequestId(id)
      await payForInstantConsult(id, doctor.fee)

      setCountdown(INSTANT_CONSULT_ACCEPT_TIMEOUT_SEC)
      setPhase('waiting')
      setPayingDoctorId(null)
    } catch (err) {
      setError(piPaymentErrorMessage(err))
      setPhase('browse')
      setPayingDoctorId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">⚡ استشارة فورية</h1>
          <p className="text-slate-400 text-sm mt-1">
            تحدث مع طبيب متاح الآن — الدفع بـ π Pi عبر Pi Browser
          </p>
        </div>

        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-sm">
          ⚠️ للحالات الطارئة اتصل بالإسعاف 997 — هذه الخدمة للاستشارات غير الطارئة فقط.
        </div>

        {phase === 'waiting' && selected && (
          <div className="mb-6 p-6 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-center">
            <div className="animate-pulse text-4xl mb-3">⏳</div>
            <p className="text-white font-medium">بانتظار قبول {selected.fullName}</p>
            <p className="text-purple-300 text-2xl font-bold mt-2">{countdown} ث</p>
            <p className="text-slate-400 text-xs mt-2">سيُبلّغ الطبيب فوراً</p>
          </div>
        )}

        {phase === 'accepted' && chatRoomId && (
          <div className="mb-6 p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
            <p className="text-emerald-400 font-medium mb-4">✅ تم قبول الاستشارة!</p>
            <Link
              href="/dashboard/client/chat"
              className="inline-block px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium"
            >
              فتح المحادثة →
            </Link>
          </div>
        )}

        {phase === 'failed' && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
            <button
              type="button"
              onClick={() => { setPhase('browse'); void loadDoctors() }}
              className="block mt-3 text-white underline text-xs"
            >
              المحاولة مجدداً
            </button>
          </div>
        )}

        {error && phase === 'browse' && (
          <p className="mb-4 text-red-400 text-sm">{error}</p>
        )}

        {phase === 'browse' && (
          <>
            <div className="mb-6">
              <label className="block text-slate-400 text-xs mb-1">سبب الاستشارة (اختياري)</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: صداع مفاجئ، استفسار عن دواء..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
              </div>
            ) : doctors.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
                <p className="text-4xl mb-3">😴</p>
                <p className="text-slate-400">لا يوجد أطباء متاحون الآن</p>
                <p className="text-slate-500 text-xs mt-2 max-w-sm mx-auto">
                  يظهر الطبيب هنا عند تفعيل «متاح الآن» وتحديد رسوم الاستشارة من لوحة الطبيب
                </p>
                <button
                  type="button"
                  onClick={() => void loadDoctors()}
                  className="mt-4 text-purple-400 text-sm hover:underline"
                >
                  ↻ تحديث
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {doctors.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]"
                  >
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-emerald-500/10 flex-shrink-0">
                      {d.avatarUrl ? (
                        <Image src={d.avatarUrl} alt="" fill unoptimized className="object-cover" />
                      ) : (
                        <span className="flex items-center justify-center w-full h-full text-xl">👨‍⚕️</span>
                      )}
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{d.fullName}</p>
                      <p className="text-emerald-400 text-xs">{d.specialization}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        ⭐ {d.averageRating.toFixed(1)} · {d.durationMinutes} د · {d.fee} π
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!!payingDoctorId}
                      onClick={() => void startConsult(d)}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50 flex-shrink-0"
                    >
                      {payingDoctorId === d.id ? '...' : 'ابدأ'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
