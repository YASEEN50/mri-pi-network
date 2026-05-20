// src/app/api/publications/[id]/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role, PublicationStatus } from '@prisma/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const pub = await prisma.publication.findFirst({
      where:   { id, deletedAt: null },
      include: {
        doctor: {
          select: {
            id: true, firstName: true, lastName: true,
            specialization: true, avatarUrl: true, bio: true,
            city: true, averageRating: true, totalReviews: true,
          },
        },
      },
    })

    if (!pub || pub.status !== PublicationStatus.PUBLISHED) {
      return ok({ error: true, message: 'المنشور غير موجود' })
    }

    // زيادة عداد المشاهدات
    await prisma.publication.update({
      where: { id },
      data:  { viewCount: { increment: 1 } },
    })

    return ok({
      id:          pub.id,
      title:       pub.title,
      summary:     pub.summary,
      content:     pub.content,
      type:        pub.type,
      tags:        pub.tags,
      coverUrl:    pub.coverUrl,
      viewCount:   pub.viewCount + 1,
      likeCount:   pub.likeCount,
      publishedAt: pub.publishedAt,
      author: pub.doctor ? {
        id:             pub.doctor.id,
        name:           `د. ${pub.doctor.firstName} ${pub.doctor.lastName}`,
        specialization: pub.doctor.specialization,
        avatarUrl:      pub.doctor.avatarUrl,
        bio:            pub.doctor.bio,
        city:           pub.doctor.city,
        rating:         Number(pub.doctor.averageRating),
        reviews:        pub.doctor.totalReviews,
      } : null,
    })
  } catch (err) {
    console.error('[GET /api/publications/[id]]', err)
    return serverError()
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const body   = await req.json()

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: auth.context.userId }, select: { id: true },
    })

    const pub = await prisma.publication.findFirst({ where: { id, deletedAt: null } })
    if (!pub || pub.doctorId !== doctor?.id) return ok({ error: true, message: 'غير مصرح' })

    await prisma.publication.update({
      where: { id },
      data: {
        ...(body.title       && { title:   body.title }),
        ...(body.summary     && { summary: body.summary }),
        ...(body.content     && { content: body.content }),
        ...(body.tags        && { tags:    body.tags }),
        ...(body.coverUrl    && { coverUrl: body.coverUrl }),
        ...(body.publish !== undefined && {
          status:      body.publish ? PublicationStatus.PUBLISHED : PublicationStatus.DRAFT,
          publishedAt: body.publish ? new Date() : null,
        }),
      },
    })

    return ok({ message: 'تم تحديث المنشور' })
  } catch (err) {
    console.error('[PATCH /api/publications/[id]]', err)
    return serverError()
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR, Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params

    await prisma.publication.update({ where: { id }, data: { deletedAt: new Date() } })
    return ok({ message: 'تم حذف المنشور' })
  } catch (err) {
    console.error('[DELETE /api/publications/[id]]', err)
    return serverError()
  }
}
