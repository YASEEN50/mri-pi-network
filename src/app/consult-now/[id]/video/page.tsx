'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import DashboardShell from '@/components/dashboard/DashboardShell'
import JitsiVideoEmbed from '@/components/video/JitsiVideoEmbed'
import { getChatPath } from '@/lib/chat/paths'

interface VideoSession {
  canJoin: boolean
  reason?: string | null
  roomName?: string | null
  serverUrl?: string | null
  displayName?: string
  chatRoomId?: string | null
  chatHref?: string | null
  error?: boolean
  message?: string
}

export default function InstantConsultVideoPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const roomFromUrl = searchParams.get('room')
  const { data: session } = useSession()
  const t = useTranslations('dashboard.chat')
  const [videoSession, setVideoSession] = useState<VideoSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/instant-consult/${id}/video`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.error) {
          setVideoSession({ canJoin: false, error: true, message: d.data.message })
        } else {
          setVideoSession(d.data)
        }
      })
      .catch(() =>
        setVideoSession({
          canJoin: false,
          error: true,
          message: 'تعذر تحميل مكالمة الفيديو',
        }),
      )
      .finally(() => setLoading(false))
  }, [id])

  const chatHref = useMemo(() => {
    const roomId = roomFromUrl ?? videoSession?.chatRoomId ?? null
    return getChatPath(session?.user?.role, roomId)
  }, [roomFromUrl, videoSession?.chatRoomId, session?.user?.role])

  const reasonMessage = (reason?: string | null) => {
    if (reason === 'expired') return 'انتهت مدة الاستشارة'
    if (reason === 'not_accepted') return 'لم يُقبل الطلب بعد'
    if (reason === 'disabled') return 'مكالمات الفيديو غير مفعّلة'
    return 'المكالمة غير متاحة'
  }

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">📹 {t('video')}</h1>
            <p className="text-slate-400 text-sm mt-1">{t('video_return_hint')}</p>
          </div>
          <Link
            href={chatHref}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium shrink-0"
          >
            💬 {t('back_to_chat')}
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : videoSession?.canJoin && videoSession.roomName && videoSession.serverUrl ? (
          <>
            <JitsiVideoEmbed
              serverUrl={videoSession.serverUrl}
              roomName={videoSession.roomName}
              displayName={videoSession.displayName ?? 'مستخدم'}
            />
            <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="text-slate-400 text-sm flex-1">{t('video_end_flow_hint')}</p>
              <Link
                href={chatHref}
                className="inline-flex items-center justify-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium shrink-0"
              >
                💬 {t('back_to_chat')}
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-16 mpi-card">
            <p className="text-red-400 mb-4">
              {videoSession?.message ?? reasonMessage(videoSession?.reason)}
            </p>
            <Link href={chatHref} className="text-emerald-400 text-sm hover:underline">
              💬 {t('back_to_chat')}
            </Link>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
