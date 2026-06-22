// src/app/api/publications/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma } from '@/lib/prisma'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { Role, PublicationType, PublicationStatus } from '@prisma/client'
import { z } from 'zod'
import {
  notifyAdminsPublicationPendingReview,
} from '@/lib/notifications/service'

const CreateSchema = z.object({
  title:   z.string().min(5).max(300),
  summary: z.string().max(500).optional(),
  content: z.string().min(50).max(20000),
  type:    z.nativeEnum(PublicationType).default(PublicationType.ARTICLE),
  tags:    z.array(z.string()).max(10).default([]),
  coverUrl: z.string().url().optional(),
  publish: z.boolean().default(false),
})

function resolveDoctorSubmitStatus(publish: boolean): PublicationStatus {
  return publish ? PublicationStatus.PENDING_REVIEW : PublicationStatus.DRAFT
}

// GET — جلب المنشورات العامة أو منشورات الطبيب
export async function GET(req: NextRequest) {
  try {
    const page   = Number(req.nextUrl.searchParams.get('page')  ?? 1)
    const limit  = Number(req.nextUrl.searchParams.get('limit') ?? 12)
    const type   = req.nextUrl.searchParams.get('type') as PublicationType | null
    const search = req.nextUrl.searchParams.get('search') ?? ''
    const mine   = req.nextUrl.searchParams.get('mine') === 'true'
    const skip   = (page - 1) * limit

    let where: Record<string, unknown> = { deletedAt: null }

    if (mine) {
      const auth = await requireAuth({ roles: [Role.DOCTOR] })
      if (!auth.success) return fromAppError(auth.error)
      const doctor = await prisma.doctorProfile.findUnique({
        where: { userId: auth.context.userId }, select: { id: true },
      })
      where.doctorId = doctor?.id
    } else {
      where.status = PublicationStatus.PUBLISHED
    }

    if (type)   where.type = type
    if (search) {
      where.OR = [
        { title:   { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { tags:    { has: search } },
      ]
    }

    const [publications, total] = await Promise.all([
      prisma.publication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          doctor: { select: { firstName: true, lastName: true, specialization: true, avatarUrl: true } },
        },
      }),
      prisma.publication.count({ where }),
    ])

    return ok(
      publications.map((p) => ({
        id:          p.id,
        title:       p.title,
        summary:     p.summary,
        type:        p.type,
        status:      p.status,
        tags:        p.tags,
        coverUrl:    p.coverUrl,
        viewCount:   p.viewCount,
        likeCount:   p.likeCount,
        publishedAt: p.publishedAt,
        createdAt:   p.createdAt,
        author:      p.doctor ? `د. ${p.doctor.firstName} ${p.doctor.lastName}` : null,
        authorSpecialty: p.doctor?.specialization ?? null,
        authorAvatar:    p.doctor?.avatarUrl ?? null,
      })),
      { total, page, limit }
    )
  } catch (err) {
    console.error('[GET /api/publications]', err)
    return serverError()
  }
}

// POST — إرسال مقال طبي (مسودة أو للمراجعة)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const body   = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: auth.context.userId }, select: { id: true },
    })
    if (!doctor) return ok({ error: true, message: 'ملف الطبيب غير موجود' })

    const status = resolveDoctorSubmitStatus(parsed.data.publish)

    const pub = await prisma.publication.create({
      data: {
        doctorId:    doctor.id,
        title:       parsed.data.title,
        summary:     parsed.data.summary,
        content:     parsed.data.content,
        type:        parsed.data.type,
        tags:        parsed.data.tags,
        coverUrl:    parsed.data.coverUrl,
        status,
        publishedAt: null,
      },
    })

    if (status === PublicationStatus.PENDING_REVIEW) {
      await notifyAdminsPublicationPendingReview(pub.id, doctor.id, pub.title)
      await prisma.notification.create({
        data: {
          userId: auth.context.userId,
          title:  '📝 تم إرسال المنشور للمراجعة',
          body:   'سيُراجع فريق الإدارة منشورك ويصلك إشعار بالنتيجة.',
          type:   'PUBLICATION_SUBMITTED',
          data:   { publicationId: pub.id },
        },
      }).catch(() => {})
    }

    return created({ id: pub.id, status: pub.status })
  } catch (err) {
    console.error('[POST /api/publications]', err)
    return serverError()
  }
}
