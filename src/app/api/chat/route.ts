// src/app/api/chat/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { listChatRoomsForUser, type ChatRoomFilter } from '@/lib/chat/list-rooms'

const CreateRoomSchema = z.object({
  doctorId:      z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
})

function parseFilter(raw: string | null): ChatRoomFilter {
  return raw === 'closed' ? 'closed' : 'active'
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const filter = parseFilter(req.nextUrl.searchParams.get('filter'))
    const result = await listChatRoomsForUser(auth.context.userId, auth.context.role, filter)
    return ok(result)
  } catch (err) {
    console.error('[GET /api/chat]', err)
    return serverError()
  }
}

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
