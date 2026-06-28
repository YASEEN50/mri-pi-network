import { prisma } from '@/lib/prisma'
import { CHAT_MESSAGES_POLL_MS } from '@/lib/chat/constants'

/** How long after the last poll we still consider the user "in" the room. */
export const CHAT_PRESENCE_TTL_MS = CHAT_MESSAGES_POLL_MS * 4 + 1_000

export async function touchChatPresence(userId: string, roomId: string): Promise<void> {
  await prisma.chatPresence.upsert({
    where: { userId },
    create: { userId, roomId },
    update: { roomId },
  })
}

export async function clearChatPresence(userId: string): Promise<void> {
  await prisma.chatPresence.deleteMany({ where: { userId } })
}

export async function isUserViewingChatRoom(
  userId: string,
  roomId: string,
): Promise<boolean> {
  const row = await prisma.chatPresence.findUnique({ where: { userId } })
  if (!row || row.roomId !== roomId) return false
  return Date.now() - row.updatedAt.getTime() < CHAT_PRESENCE_TTL_MS
}
