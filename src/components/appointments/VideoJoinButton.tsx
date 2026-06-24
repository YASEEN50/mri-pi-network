'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

interface VideoJoinButtonProps {
  videoJoinPath: string | null | undefined
  canJoinVideo?: boolean
  compact?: boolean
}

export default function VideoJoinButton({
  videoJoinPath,
  canJoinVideo,
  compact,
}: VideoJoinButtonProps) {
  const tv = useTranslations('appointment.video')

  if (!videoJoinPath) return null

  const className = compact
    ? 'px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 rounded-lg text-xs transition-all text-center'
    : 'px-4 py-2.5 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 rounded-xl text-sm font-medium transition-all text-center'

  return (
    <Link href={videoJoinPath} className={className}>
      {canJoinVideo ? `📹 ${tv('join_now')}` : `📹 ${tv('join_scheduled')}`}
    </Link>
  )
}
