import { getJitsiEmbedUrl, getJitsiServerUrl, isOnlineBookingEnabled } from '@/lib/appointments/online-video'

export function getInstantConsultVideoRoomName(consultId: string): string {
  const slug = consultId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)
  return `mriInstant${slug}`
}

export function getInstantConsultVideoPath(consultId: string): string {
  return `/consult-now/${consultId}/video`
}

export function canAccessInstantConsultVideo(params: {
  status: string
  sessionEndsAt: Date | null
}): { allowed: boolean; reason?: 'not_accepted' | 'expired' | 'disabled' } {
  if (!isOnlineBookingEnabled()) return { allowed: false, reason: 'disabled' }
  if (params.status !== 'ACCEPTED') return { allowed: false, reason: 'not_accepted' }
  if (!params.sessionEndsAt || params.sessionEndsAt.getTime() <= Date.now()) {
    return { allowed: false, reason: 'expired' }
  }
  return { allowed: true }
}

export function buildInstantConsultEmbedUrl(consultId: string, displayName: string): string {
  return getJitsiEmbedUrl(getInstantConsultVideoRoomName(consultId), displayName)
}

export { getJitsiServerUrl }
