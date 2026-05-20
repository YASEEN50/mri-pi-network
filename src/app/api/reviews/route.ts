// src/app/api/reviews/route.ts
// POST — تقييم طبيب (يتطلب موعداً مكتملاً)

import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { createDoctorReview } from '@/lib/reviews/create-review'
import { rateLimitReviews, rateLimitResponse } from '@/lib/upstash-rate-limit'
import { z } from 'zod'

const PostSchema = z.object({
  doctorId:      z.string().uuid(),
  appointmentId: z.string().uuid(),
  rating:        z.number().int().min(1).max(5),
  comment:       z.string().max(1000).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await rateLimitReviews(ip)
    if (!rl.success) {
      return NextResponse.json(rateLimitResponse(rl), {
        status: 429,
        headers: { 'Retry-After': String(rl.resetIn) },
      })
    }

    const auth = await requireAuth({ roles: [Role.CLIENT] })
    if (!auth.success) return fromAppError(auth.error)

    const body   = await req.json()
    const parsed = PostSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const result = await createDoctorReview({
      clientUserId:  auth.context.userId,
      doctorId:      parsed.data.doctorId,
      appointmentId: parsed.data.appointmentId,
      rating:        parsed.data.rating,
      comment:       parsed.data.comment,
    })

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { message: result.message } },
        { status: result.status },
      )
    }

    return created({ id: result.reviewId, rating: result.rating })
  } catch (err) {
    console.error('[POST /api/reviews]', err)
    return serverError()
  }
}
