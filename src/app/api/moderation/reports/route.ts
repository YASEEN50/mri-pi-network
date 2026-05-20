// src/app/api/moderation/reports/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'
import { z } from 'zod'

const ReportSchema = z.object({
  contentType: z.enum(['PUBLICATION','REVIEW','CHAT_MESSAGE','PROFILE']),
  contentId:   z.string().uuid(),
  reason:      z.enum(['INAPPROPRIATE_CONTENT','FAKE_INFORMATION','SPAM','HARASSMENT','OTHER']),
  description: z.string().max(1000).optional(),
})

// GET — جلب التقارير (للأدمن والمالك)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const status  = req.nextUrl.searchParams.get('status') ?? 'PENDING'
    const type    = req.nextUrl.searchParams.get('type')
    const page    = Number(req.nextUrl.searchParams.get('page') ?? 1)
    const limit   = Number(req.nextUrl.searchParams.get('limit') ?? 20)
    const skip    = (page - 1) * limit

    const where: any = {}
    if (status !== 'all') where.status = status
    if (type)             where.contentType = type

    const [reports, total] = await Promise.all([
      db.contentReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
        include: {
          reporter: { select: { email: true, piUsername: true } },
        },
      }),
      db.contentReport.count({ where }),
    ])

    return ok(reports, { total, page, limit })
  } catch (err) {
    console.error('[GET /api/moderation/reports]', err)
    return serverError()
  }
}

// POST — إنشاء تقرير جديد
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const body   = await req.json()
    const parsed = ReportSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    // التحقق من عدم التكرار
    const existing = await db.contentReport.findFirst({
      where: {
        reporterId:  auth.context.userId,
        contentId:   parsed.data.contentId,
        contentType: parsed.data.contentType,
        status:      'PENDING',
      },
    })
    if (existing) return ok({ error: true, message: 'أرسلت تقريراً لهذا المحتوى مسبقاً' })

    const report = await db.contentReport.create({
      data: {
        reporterId:  auth.context.userId,
        contentType: parsed.data.contentType,
        contentId:   parsed.data.contentId,
        reason:      parsed.data.reason,
        description: parsed.data.description,
      },
    })

    return created({ id: report.id, message: 'تم إرسال التقرير بنجاح' })
  } catch (err) {
    console.error('[POST /api/moderation/reports]', err)
    return serverError()
  }
}
