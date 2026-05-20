// src/app/api/moderation/reports/[id]/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role, ActivityType } from '@prisma/client'
import { z } from 'zod'

const ActionSchema = z.object({
  status:      z.enum(['REVIEWED','ACTION_TAKEN','DISMISSED']),
  reviewNotes: z.string().max(1000).optional(),
  actionTaken: z.string().max(500).optional(),
})

// PATCH — مراجعة التقرير واتخاذ إجراء
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const body   = await req.json()
    const parsed = ActionSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const report = await db.contentReport.findUnique({ where: { id } })
    if (!report) return ok({ error: true, message: 'التقرير غير موجود' })

    // إذا action_taken — نخفي المحتوى
    if (parsed.data.status === 'ACTION_TAKEN') {
      await hideContent(report.contentType, report.contentId)
    }

    await db.contentReport.update({
      where: { id },
      data: {
        status:      parsed.data.status,
        reviewedBy:  auth.context.userId,
        reviewNotes: parsed.data.reviewNotes,
        actionTaken: parsed.data.actionTaken,
        reviewedAt:  new Date(),
      },
    })

    // تسجيل في ActivityLog
    await prisma.activityLog.create({
      data: {
        actorId:    auth.context.userId,
        action:     ActivityType.ADMIN_REVIEW_APPROVE,
        targetType: 'REPORT',
        targetId:   id,
        details:    { status: parsed.data.status, action: parsed.data.actionTaken },
      },
    })

    return ok({ message: 'تم معالجة التقرير' })
  } catch (err) {
    console.error('[PATCH /api/moderation/reports/[id]]', err)
    return serverError()
  }
}

async function hideContent(contentType: string, contentId: string) {
  try {
    switch (contentType) {
      case 'PUBLICATION':
        await db.publication.update({
          where: { id: contentId },
          data:  { status: 'DRAFT' },
        })
        break
      case 'REVIEW':
        await prisma.review.update({
          where: { id: contentId },
          data:  { deletedAt: new Date() },
        })
        break
      case 'CHAT_MESSAGE':
        await db.chatMessage.update({
          where: { id: contentId },
          data:  { deletedAt: new Date() },
        })
        break
    }
  } catch (e) {
    console.error('hideContent error', e)
  }
}
