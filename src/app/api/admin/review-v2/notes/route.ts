// GET/POST — ملاحظات داخلية على جلسة التحقق (لا تُعرض للطبيب)

import { NextRequest } from 'next/server'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { ActivityType } from '@prisma/client'
import { z } from 'zod'

const PostSchema = z.object({
  sessionId: z.string().uuid(),
  body:      z.string().min(1).max(2000),
})

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewVerification)
    if (!auth.success) return fromAppError(auth.error)

    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!sessionId) return ok({ error: true, message: 'sessionId مطلوب' })

    const notes = await db.verificationSessionNote.findMany({
      where:   { sessionId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            email: true,
            adminProfile: { select: { role: true } },
          },
        },
      },
    })

    return ok({
      notes: notes.map((n) => ({
        id:        n.id,
        body:      n.body,
        createdAt: n.createdAt,
        authorId:  n.author.id,
        authorName: n.author.email ?? 'مراجع',
      })),
    })
  } catch (err) {
    console.error('[GET /api/admin/review-v2/notes]', err)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewVerification)
    if (!auth.success) return fromAppError(auth.error)

    const parsed = PostSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { sessionId, body } = parsed.data

    const session = await db.verificationSession.findUnique({
      where:  { id: sessionId },
      select: { id: true, doctorId: true },
    })
    if (!session) return ok({ error: true, message: 'الجلسة غير موجودة' })

    const note = await db.verificationSessionNote.create({
      data: {
        sessionId,
        authorId: auth.context.userId,
        body:     body.trim(),
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            email: true,
            adminProfile: { select: { role: true } },
          },
        },
      },
    })

    await prisma.activityLog.create({
      data: {
        actorId:    auth.context.userId,
        action:     ActivityType.VERIFICATION_INTERNAL_NOTE,
        targetType: 'VERIFICATION_SESSION',
        targetId:   sessionId,
        details:    { noteId: note.id, doctorId: session.doctorId },
      },
    }).catch(() => {})

    return ok({
      note: {
        id:         note.id,
        body:       note.body,
        createdAt:  note.createdAt,
        authorId:   note.author.id,
        authorName: note.author.email ?? 'مراجع',
      },
    })
  } catch (err) {
    console.error('[POST /api/admin/review-v2/notes]', err)
    return serverError()
  }
}
