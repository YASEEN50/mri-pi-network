import { InstantConsultStatus, Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getChatRoomForUser, getChatRecipientUserId } from '@/lib/chat/access'
import { notifyInstantConsultReviewRequested } from '@/lib/reviews/notifications'

export async function closeChatRoom(
  roomId: string,
  userId: string,
  role: Role,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const room = await getChatRoomForUser(roomId, userId, role)
  if (!room) return { ok: false, message: 'الغرفة غير موجودة' }
  if (room.status !== 'ACTIVE') return { ok: false, message: 'المحادثة مغلقة مسبقاً' }

  await prisma.$transaction(async (tx) => {
    await tx.chatRoom.update({
      where: { id: roomId },
      data: { status: 'CLOSED' },
    })

    const consult = await tx.instantConsultRequest.findFirst({
      where: { chatRoomId: roomId, status: InstantConsultStatus.ACCEPTED },
    })
    if (consult) {
      await tx.instantConsultRequest.update({
        where: { id: consult.id },
        data: { status: InstantConsultStatus.COMPLETED, completedAt: new Date() },
      })
    }
  })

  const completedConsult = await prisma.instantConsultRequest.findFirst({
    where: { chatRoomId: roomId, status: InstantConsultStatus.COMPLETED },
    select: { id: true },
    orderBy: { completedAt: 'desc' },
  })
  if (completedConsult) {
    notifyInstantConsultReviewRequested(completedConsult.id).catch(console.error)
  }

  const recipientUserId = await getChatRecipientUserId(room, userId)
  if (recipientUserId) {
    const body =
      role === Role.DOCTOR
        ? 'أنهى الطبيب جلسة المحادثة'
        : 'أنهى المريض جلسة المحادثة'

    await prisma.notification.create({
      data: {
        userId: recipientUserId,
        title: '🔚 انتهت المحادثة',
        body,
        type: 'CHAT_CLOSED',
        data: { roomId },
      },
    })
  }

  return { ok: true }
}
