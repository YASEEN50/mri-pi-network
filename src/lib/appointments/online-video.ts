/** Jitsi-based online consultation (meet.jit.si) — disable via ONLINE_APPOINTMENTS_ENABLED=false */

export function isOnlineBookingEnabled(): boolean {
  return process.env.ONLINE_APPOINTMENTS_ENABLED !== 'false'
}

export function getJitsiServerUrl(): string {
  return (process.env.JITSI_SERVER_URL ?? 'https://meet.jit.si').replace(/\/$/, '')
}

export function getVideoRoomName(appointmentId: string): string {
  const slug = appointmentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)
  return `mriConsult${slug}`
}

export function getVideoJoinPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/video`
}

const EARLY_JOIN_MS = 15 * 60 * 1000
const LATE_JOIN_MS = 15 * 60 * 1000

export type VideoAccessReason =
  | 'not_online'
  | 'not_confirmed'
  | 'disabled'
  | 'too_early'
  | 'expired'

export function canAccessVideoCall(params: {
  type: string
  status: string
  scheduledAt: Date
  duration: number
}): { allowed: boolean; reason?: VideoAccessReason } {
  if (!isOnlineBookingEnabled()) return { allowed: false, reason: 'disabled' }
  if (params.type !== 'ONLINE') return { allowed: false, reason: 'not_online' }
  if (params.status !== 'CONFIRMED') return { allowed: false, reason: 'not_confirmed' }

  const now = Date.now()
  const start = params.scheduledAt.getTime()
  const end = start + params.duration * 60 * 1000

  if (now < start - EARLY_JOIN_MS) return { allowed: false, reason: 'too_early' }
  if (now > end + LATE_JOIN_MS) return { allowed: false, reason: 'expired' }

  return { allowed: true }
}

export function appointmentVideoFields(apt: {
  id: string
  type: string
  status: string
  scheduledAt: Date
  duration: number
}) {
  const access = canAccessVideoCall(apt)
  const isOnlineConfirmed =
    isOnlineBookingEnabled() && apt.type === 'ONLINE' && apt.status === 'CONFIRMED'

  return {
    canJoinVideo: access.allowed,
    videoJoinPath: isOnlineConfirmed ? getVideoJoinPath(apt.id) : null,
    videoUnavailableReason: isOnlineConfirmed && !access.allowed ? access.reason : null,
  }
}

const JITSI_HASH = [
  'config.prejoinPageEnabled=true',
  'config.disableDeepLinking=true',
  'config.enableLobby=false',
  'config.enableWelcomePage=false',
  'config.startWithAudioMuted=false',
  'config.startWithVideoMuted=false',
  'interfaceConfig.MOBILE_APP_PROMO=false',
  'interfaceConfig.SHOW_JITSI_WATERMARK=false',
].join('&')

export function getJitsiEmbedUrl(roomName: string, displayName: string): string {
  const base = getJitsiServerUrl()
  const name = encodeURIComponent(displayName)
  return `${base}/${roomName}#userInfo.displayName="${name}"&${JITSI_HASH}`
}

/** رابط مباشر — يعمل أفضل على الموبايل/Pi (بدون iframe متداخل) */
export function getJitsiDirectJoinUrl(roomName: string, displayName: string): string {
  return getJitsiEmbedUrl(roomName, displayName)
}

/** إعدادات Jitsi External API */
export function getJitsiClientConfig() {
  return {
    configOverwrite: {
      prejoinPageEnabled: true,
      disableDeepLinking: true,
      enableWelcomePage: false,
      enableLobby: false,
      startWithAudioMuted: false,
      startWithVideoMuted: false,
      disableThirdPartyRequests: true,
    },
    interfaceConfigOverwrite: {
      MOBILE_APP_PROMO: false,
      SHOW_JITSI_WATERMARK: false,
      SHOW_WATERMARK_FOR_GUESTS: false,
      APP_NAME: 'MRI Consult',
      NATIVE_APP_NAME: 'MRI Consult',
      DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
      HIDE_INVITE_MORE_HEADER: true,
    },
  }
}
