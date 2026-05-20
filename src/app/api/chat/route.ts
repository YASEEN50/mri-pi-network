// src/app/api/chat/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'
import { z } from 'zod'

const CreateRoomSchema = z.object({
  doctorId:      z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
})

// GET — جلب غرف المحادثة للمستخدم
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { userId, role } = auth.context

    let where: any = {}
    if (role === Role.CLIENT) {
      const profile = await prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } })
      where.clientId = profile?.id
    } else if (role === Role.DOCTOR) {
      const doctor = await prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true } })
      where.doctorId = doctor?.id
    }

    const rooms = await db.chatRoom.findMany({
      where:   { ...where, status: 'ACTIVE' },
      orderBy: { lastMessageAt: 'desc' },
      take:    20,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true, senderId: true, isRead: true },
        },
      },
    })

    // جلب معلومات الطرف الآخر
    const result = await Promise.all(rooms.map(async (room: any) => {
      let otherParty = null
      if (role === Role.CLIENT) {
        const doc = await prisma.doctorProfile.findUnique({
          where: { id: room.doctorId },
          select: { firstName: true, lastName: true, specialization: true, avatarUrl: true },
        })
        otherParty = doc ? { name: `د. ${doc.firstName} ${doc.lastName}`, specialization: doc.specialization, avatarUrl: doc.avatarUrl } : null
      } else {
        const client = await prisma.clientProfile.findUnique({
          where: { id: room.clientId },
          select: { firstName: true, lastName: true },
        })
        otherParty = client ? { name: `${client.firstName} ${client.lastName}` } : null
      }

      const lastMsg = room.messages[0]
      const unread  = await db.chatMessage.count({
        where: { roomId: room.id, isRead: false, senderId: { not: userId } },
      })

      return {
        id:          room.id,
        status:      room.status,
        otherParty,
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.createdAt ?? room.createdAt,
        unreadCount: unread,
      }
    }))

    return ok(result)
  } catch (err) {
    console.error('[GET /api/chat]', err)
    return serverError()
  }
}

// POST — إنشاء غرفة محادثة جديدة
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.CLIENT] })
    if (!auth.success) return fromAppError(auth.error)

    const body   = await req.json()
    const parsed = CreateRoomSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const profile = await prisma.clientProfile.findUnique({
      where: { userId: auth.context.userId }, select: { id: true },
    })
    if (!profile) return ok({ error: true, message: 'ملف المريض غير موجود' })

    // التحقق من وجود غرفة مسبقاً
    const existing = await db.chatRoom.findFirst({
      where: {
        clientId: profile.id,
        doctorId: parsed.data.doctorId,
        status:   'ACTIVE',
      },
    })

    if (existing) return ok({ id: existing.id, existing: true })

    const room = await db.chatRoom.create({
      data: {
        clientId:      profile.id,
        doctorId:      parsed.data.doctorId,
        appointmentId: parsed.data.appointmentId,
      },
    })

    return created({ id: room.id })
  } catch (err) {
    console.error('[POST /api/chat]', err)
    return serverError()
  }
}
