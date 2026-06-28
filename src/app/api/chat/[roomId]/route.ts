// src/app/api/chat/[roomId]/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { getChatRoomForUser, getChatRecipientUserId } from '@/lib/chat/access'
import { CHAT_MESSAGES_PAGE_SIZE } from '@/lib/chat/constants'
import {
  isUserViewingChatRoom,
  touchChatPresence,
} from '@/lib/chat/presence'
import { z } from 'zod'

const MsgSchema = z.object({
  content:  z.string().min(1).max(2000),
  fileUrl:  z.string().url().optional(),
  fileType: z.string().optional(),
})

function mapMessage(msg: {
  id: string
  senderId: string
  content: string
  createdAt: Date
  fileUrl: string | null
}) {
  return {
    id:        msg.id,
    senderId:  msg.senderId,
    content:   msg.content,
    createdAt: msg.createdAt,
    fileUrl:   msg.fileUrl ?? undefined,
  }
}

// GET — جلب رسائل الغرفة (يدعم ?since=ISO للـ polling)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { roomId } = await params
    const since = req.nextUrl.searchParams.get('since')
    const page  = Number(req.nextUrl.searchParams.get('page') ?? 1)
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? CHAT_MESSAGES_PAGE_SIZE)

    const room = await getChatRoomForUser(roomId, auth.context.userId, auth.context.role)
    if (!room) return ok({ error: true, message: 'الغرفة غير موجودة' })

    if (room.status === 'ACTIVE') {
      await touchChatPresence(auth.context.userId, roomId)
    }

    if (since) {
      const sinceDate = new Date(since)
      if (Number.isNaN(sinceDate.getTime())) {
        return ok({ error: true, message: 'تاريخ since غير صالح' })
      }

      const messages = await db.chatMessage.findMany({
        where: {
          roomId,
          deletedAt: null,
          createdAt: { gt: sinceDate },
        },
        orderBy: { createdAt: 'asc' },
        take:    100,
      })

      if (messages.length > 0) {
        await db.chatMessage.updateMany({
          where: {
            roomId,
            isRead: false,
            senderId: { not: auth.context.userId },
            id: { in: messages.map((m: { id: string }) => m.id) },
          },
          data: { isRead: true, readAt: new Date() },
        })
      }

      return ok(messages.map(mapMessage))
    }

    const skip = (page - 1) * limit
    const [messages, total] = await Promise.all([
      db.chatMessage.findMany({
        where:   { roomId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.chatMessage.count({ where: { roomId, deletedAt: null } }),
    ])

    await db.chatMessage.updateMany({
      where: { roomId, isRead: false, senderId: { not: auth.context.userId } },
      data:  { isRead: true, readAt: new Date() },
    })

    return ok(messages.reverse().map(mapMessage), { total, page, limit })
  } catch (err) {
    console.error('[GET /api/chat/[roomId]]', err)
    return serverError()
  }
}

// POST — إرسال رسالة
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { roomId } = await params
    const body       = await req.json()
    const parsed     = MsgSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'الرسالة فارغة' })

    const room = await getChatRoomForUser(roomId, auth.context.userId, auth.context.role)
    if (!room || room.status !== 'ACTIVE') {
      return ok({ error: true, message: 'الغرفة غير متاحة' })
    }

    const [message] = await prisma.$transaction([
      db.chatMessage.create({
        data: {
          roomId,
          senderId: auth.context.userId,
          content:  parsed.data.content,
          fileUrl:  parsed.data.fileUrl,
          fileType: parsed.data.fileType,
        },
      }),
      db.chatRoom.update({
        where: { id: roomId },
        data:  { lastMessageAt: new Date() },
      }),
    ])

    const recipientUserId = await getChatRecipientUserId(room, auth.context.userId)
    if (recipientUserId) {
      const viewing = await isUserViewingChatRoom(recipientUserId, roomId)
      if (!viewing) {
        const preview = parsed.data.content.length > 80
          ? `${parsed.data.content.slice(0, 80)}…`
          : parsed.data.content

        await prisma.notification.create({
          data: {
            userId: recipientUserId,
            title:  '💬 رسالة جديدة',
            body:   preview,
            type:   'CHAT_MESSAGE',
            data:   { roomId, messageId: message.id },
          },
        })
      }
    }

    return created(mapMessage(message))
  } catch (err) {
    console.error('[POST /api/chat/[roomId]]', err)
    return serverError()
  }
}
