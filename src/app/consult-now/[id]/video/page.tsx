'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'

interface VideoSession {
  canJoin: boolean
  reason?: string | null
  embedUrl?: string | null
  error?: boolean
  message?: string
}

export default function InstantConsultVideoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [session, setSession] = useState<VideoSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/instant-consult/${id}/video`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.error) {
          setSession({ canJoin: false, error: true, message: d.data.message })
        } else {
          setSession(d.data)
        }
      })
      .catch(() => setSession({ canJoin: false, error: true, message: 'تعذر تحميل مكالمة الفيديو' }))
      .finally(() => setLoading(false))
  }, [id])

  const reasonMessage = (reason?: string | null) => {
    if (reason === 'expired') return 'انتهت مدة الاستشارة'
    if (reason === 'not_accepted') return 'لم يُقبل الطلب بعد'
    if (reason === 'disabled') return 'مكالمات الفيديو غير مفعّلة'
    return 'المكالمة غير متاحة'
  }

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">📹 استشارة فيديو فورية</h1>
            <p className="text-slate-400 text-sm mt-1">محادثة فيديو مع الطبيب خلال مدة الجلسة</p>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-sm"
          >
            رجوع
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : session?.canJoin && session.embedUrl ? (
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40">
            <iframe
              title="Instant consult video"
              src={session.embedUrl}
              allow="camera; microphone; fullscreen; display-capture"
              className="w-full min-h-[70vh] md:min-h-[520px] border-0"
            />
          </div>
        ) : (
          <div className="text-center py-16 mpi-card">
            <p className="text-red-400 mb-4">{session?.message ?? reasonMessage(session?.reason)}</p>
            <Link href="/dashboard/client/chat" className="text-emerald-400 text-sm hover:underline">
              العودة للمحادثة
            </Link>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
