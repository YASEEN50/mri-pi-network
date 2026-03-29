// =============================================================================
// src/app/api/doctors/[id]/reviews/route.ts
// GET /api/doctors/[id]/reviews
// POST /api/doctors/[id]/reviews
// =============================================================================

import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/email-auth.provider'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { AddReviewSchema } from '@/lib/validations/doctor.schema'
import { AddReviewUseCase } from '@/core/use-cases/appointment/create-appointment.use-case'
import { prisma } from '@/infrastructure/database/prisma/client'
import { NotFoundError } from '@/core/errors'

// ---------------------------------------------------------------------------
// GET /api/doctors/[id]/reviews
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const page  = Number(req.nextUrl.searchParams.get('page')  ?? 1)
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 10)
    const skip  = (page - 1) * limit

    const [reviews, total] = await prisma.$transaction([
      prisma.review.findMany({
        where: { doctorId: params.id, isVisible: true, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          client: {
            include: { clientProfile: { select: { firstName: true, lastName: true } } },
          },
        },
      }),
      prisma.review.count({
        where: { doctorId: params.id, isVisible: true, deletedAt: null },
      }),
    ])

    return ok(
      reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
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

// ---------------------------------------------------------------------------
// POST /api/doctors/[id]/reviews
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth({ roles: [Role.CLIENT] })
    if (!auth.success) return fromAppError(auth.error)

    // التحقق من وجود الطبيب
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: params.id, deletedAt: null },
      select: { id: true },
    })
    if (!doctor) return fromAppError(new NotFoundError('الطبيب', params.id))

    const body = await req.json()
    const parsed = AddReviewSchema.safeParse(body)
    if (!parsed.success) {
      const { fromZodError } = await import('@/lib/api-response')
      return fromZodError(parsed.error)
    }

    const useCase = new AddReviewUseCase()
    const result = await useCase.execute({
      clientId: auth.context.userId,
      appointmentId: parsed.data.appointmentId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    })

    if (!result.success) return fromAppError(result.error)
    return created(result.data)
  } catch (err) {
    console.error('[POST /api/doctors/[id]/reviews]', err)
    return serverError()
  }
}
