import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { NotFoundError } from '@/core/errors'
import { prisma } from '@/lib/prisma'
import { createDoctorReview } from '@/lib/reviews/create-review'
import { rateLimitReviews, rateLimitResponse } from '@/lib/upstash-rate-limit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const AddReviewSchema = z.object({
  appointmentId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const page  = Number(req.nextUrl.searchParams.get('page')  ?? 1)
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 10)
    const skip  = (page - 1) * limit

    const [reviews, total] = await prisma.$transaction([
      prisma.review.findMany({
        where: { doctorId: id, isVisible: true, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
        include: {
          client: { include: { clientProfile: { select: { firstName: true, lastName: true } } } },
        },
      }),
      prisma.review.count({ where: { doctorId: id, isVisible: true, deletedAt: null } }),
    ])

    return ok(
      reviews.map((r: any) => ({
        id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt,
        client: {
          name: r.client.clientProfile
            ? `${r.client.clientProfile.firstName} ${r.client.clientProfile.lastName}`
            : 'مستخدم',
        },
      })),
      { total, page, limit }
    )
  } catch (err) {
    console.error('[GET /api/doctors/[id]/reviews]', err)
    return serverError()
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await rateLimitReviews(ip)
    if (!rl.success) {
      return NextResponse.json(rateLimitResponse(rl), {
        status: 429,
        headers: { 'Retry-After': String(rl.resetIn) },
      })
    }

    const { id } = await params
    const auth = await requireAuth({ roles: [Role.CLIENT] })
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = AddReviewSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const result = await createDoctorReview({
      clientUserId:  auth.context.userId,
      doctorId:      id,
      appointmentId: parsed.data.appointmentId,
      rating:        parsed.data.rating,
      comment:       parsed.data.comment,
    })

    if (!result.ok) {
      if (result.status === 404) {
        return fromAppError(new NotFoundError(result.message))
      }
      return NextResponse.json(
        { success: false, error: { message: result.message } },
        { status: result.status },
      )
    }

    return created({ id: result.reviewId, rating: result.rating })
  } catch (err) {
    console.error('[POST /api/doctors/[id]/reviews]', err)
    return serverError()
  }
}
