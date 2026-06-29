import { ChatRoomStatus, Role } from '@prisma/client'
import { prisma, db } from '@/lib/prisma'

export type ChatRoomFilter = 'active' | 'closed'

function statusForFilter(filter: ChatRoomFilter): ChatRoomStatus {
  return filter === 'closed' ? 'CLOSED' : 'ACTIVE'
}

export async function listChatRoomsForUser(
  userId: string,
  role: Role,
  filter: ChatRoomFilter = 'active',
) {
  let where: { clientId?: string; doctorId?: string } = {}
  if (role === Role.CLIENT) {
    const profile = await prisma.clientProfile.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!profile) return []
    where.clientId = profile.id
  } else if (role === Role.DOCTOR) {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!doctor) return []
    where.doctorId = doctor.id
  } else {
    return []
  }

  const rooms = await db.chatRoom.findMany({
    where: { ...where, status: statusForFilter(filter) },
    orderBy: { lastMessageAt: 'desc' },
    take: 30,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, createdAt: true, senderId: true, isRead: true },
      },
    },
  })

  return Promise.all(
    rooms.map(async (room: (typeof rooms)[number]) => {
      let otherParty: {
        name?: string
        specialization?: string
        avatarUrl?: string | null
      } | null = null

      if (role === Role.CLIENT) {
        const doc = await prisma.doctorProfile.findUnique({
          where: { id: room.doctorId },
          select: { firstName: true, lastName: true, specialization: true, avatarUrl: true },
        })
        otherParty = doc
          ? {
              name: `د. ${doc.firstName} ${doc.lastName}`,
              specialization: doc.specialization,
              avatarUrl: doc.avatarUrl,
            }
          : null
      } else {
        const client = await prisma.clientProfile.findUnique({
          where: { id: room.clientId },
          select: { firstName: true, lastName: true },
        })
        otherParty = client
          ? { name: `${client.firstName} ${client.lastName}` }
          : null
      }

      const lastMsg = room.messages[0]
      const unread =
        filter === 'active'
          ? await db.chatMessage.count({
              where: {
                roomId: room.id,
                isRead: false,
                senderId: { not: userId },
              },
            })
          : 0

      return {
        id: room.id,
        status: room.status,
        otherParty,
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: (lastMsg?.createdAt ?? room.createdAt).toISOString(),
        unreadCount: unread,
      }
    }),
  )
}
