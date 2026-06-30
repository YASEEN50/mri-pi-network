'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import DashboardShell from '@/components/dashboard/DashboardShell'
import JitsiVideoEmbed from '@/components/video/JitsiVideoEmbed'

interface VideoSession {
  canJoin: boolean
  reason?: string | null
  roomName?: string | null
  serverUrl?: string | null
  displayName?: string
  scheduledAt?: string
  duration?: number
  error?: boolean
  message?: string
}

export default function AppointmentVideoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const tv = useTranslations('appointment.video')
  const [session, setSession] = useState<VideoSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/appointments/${id}/video`)
      .then(r => r.json())
      .then(d => {
        if (d.data?.error) {
          setSession({ canJoin: false, error: true, message: d.data.message })
        } else {
          setSession(d.data)
        }
      })
      .catch(() => setSession({ canJoin: false, error: true, message: tv('load_error') }))
      .finally(() => setLoading(false))
  }, [id, tv])

  const reasonMessage = (reason?: string | null) => {
    if (reason === 'too_early') return tv('too_early')
    if (reason === 'expired') return tv('expired')
    if (reason === 'not_confirmed') return tv('not_confirmed')
    if (reason === 'not_online') return tv('not_online')
    if (reason === 'disabled') return tv('disabled')
    return tv('unavailable')
  }

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">{tv('title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{tv('subtitle')}</p>
          </div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-sm hover:bg-white/10 transition-all"
          >
            {tv('back')}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : session?.error ? (
          <div className="text-center py-16 mpi-card">
            <p className="text-red-400 mb-4">{session.message}</p>
            <Link href="/dashboard/client/appointments" className="text-emerald-400 text-sm hover:underline">
              {tv('back_to_appointments')}
            </Link>
          </div>
        ) : session?.canJoin && session.roomName && session.serverUrl ? (
          <JitsiVideoEmbed
            serverUrl={session.serverUrl}
            roomName={session.roomName}
            displayName={session.displayName ?? 'مستخدم'}
            returnUrl="/dashboard/client/appointments"
          />
        ) : (
          <div className="text-center py-16 mpi-card">
            <div className="text-4xl mb-4">💻</div>
            <p className="text-slate-300 mb-2">{reasonMessage(session?.reason)}</p>
            {session?.scheduledAt && (
              <p className="text-slate-500 text-sm mb-6">
                {new Date(session.scheduledAt).toLocaleString()}
              </p>
            )}
            <Link href="/dashboard/client/appointments" className="text-emerald-400 text-sm hover:underline">
              {tv('back_to_appointments')}
            </Link>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
