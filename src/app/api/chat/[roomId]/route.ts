// src/app/api/chat/[roomId]/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { z } from 'zod'

const MsgSchema = z.object({
  content:  z.string().min(1).max(2000),
  fileUrl:  z.string().url().optional(),
  fileType: z.string().optional(),
})

// GET — جلب رسائل الغرفة
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { roomId } = await params
    const page       = Number(req.nextUrl.searchParams.get('page') ?? 1)
    const limit      = Number(req.nextUrl.searchParams.get('limit') ?? 30)
    const skip       = (page - 1) * limit

    const room = await db.chatRoom.findUnique({ where: { id: roomId } })
    if (!room) return ok({ error: true, message: 'الغرفة غير موجودة' })

    const [messages, total] = await Promise.all([
      db.chatMessage.findMany({
        where:   { roomId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      db.chatMessage.count({ where: { roomId, deletedAt: null } }),
    ])

    // تعليم رسائل الطرف الآخر كمقروءة
    await db.chatMessage.updateMany({
      where: { roomId, isRead: false, senderId: { not: auth.context.userId } },
      data:  { isRead: true, readAt: new Date() },
    })

    return ok(messages.reverse(), { total, page, limit })
  } catch (err) {
    console.error('[GET /api/chat/[roomId]]', err)
    return serverError()
  }
}

// POST — إرسال رسالة
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { roomId } = await params
    const body       = await req.json()
    const parsed     = MsgSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'الرسالة فارغة' })

    const room = await db.chatRoom.findUnique({ where: { id: roomId } })
    if (!room || room.status !== 'ACTIVE') return ok({ error: true, message: 'الغرفة غير متاحة' })

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

    return created({
      id:        message.id,
      content:   message.content,
      senderId:  message.senderId,
      createdAt: message.createdAt,
    })
  } catch (err) {
    console.error('[POST /api/chat/[roomId]]', err)
    return serverError()
  }
}
