import { Role } from '@prisma/client'
import { prisma, db } from '@/lib/prisma'

export async function getChatRoomForUser(
  roomId: string,
  userId: string,
  role: Role,
) {
  const room = await db.chatRoom.findUnique({ where: { id: roomId } })
  if (!room) return null

  if (role === Role.CLIENT) {
    const profile = await prisma.clientProfile.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!profile || room.clientId !== profile.id) return null
    return room
  }

  if (role === Role.DOCTOR) {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!doctor || room.doctorId !== doctor.id) return null
    return room
  }

  return null
}

export async function getChatRecipientUserId(
  room: { clientId: string; doctorId: string },
  senderUserId: string,
): Promise<string | null> {
  const [client, doctor] = await Promise.all([
    prisma.clientProfile.findUnique({
      where: { id: room.clientId },
      select: { userId: true },
    }),
    prisma.doctorProfile.findUnique({
      where: { id: room.doctorId },
      select: { userId: true },
    }),
  ])

  if (client?.userId === senderUserId) return doctor?.userId ?? null
  if (doctor?.userId === senderUserId) return client?.userId ?? null
  return null
}
