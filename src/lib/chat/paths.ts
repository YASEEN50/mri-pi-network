import { Role } from '@prisma/client'

export function getChatPath(role?: string, roomId?: string | null): string {
  const base =
    role === Role.DOCTOR ? '/dashboard/doctor/chat' : '/dashboard/client/chat'
  if (roomId) return `${base}?room=${encodeURIComponent(roomId)}`
  return base
}

export function getInstantConsultVideoPath(
  consultId: string,
  roomId?: string | null,
): string {
  const path = `/consult-now/${consultId}/video`
  if (roomId) return `${path}?room=${encodeURIComponent(roomId)}`
  return path
}
