import { prisma } from '@/lib/prisma'
import { InstantConsultStatus } from '@prisma/client'
import { notifyReviewReceived } from '@/lib/reviews/notifications'
import { refreshDoctorRatingStats } from '@/lib/reviews/update-doctor-rating'

export interface CreateInstantConsultReviewInput {
  clientUserId: string
  doctorId: string
  instantConsultId: string
  rating: number
  comment?: string
}

export type CreateInstantConsultReviewResult =
  | { ok: true; reviewId: string; rating: number }
  | { ok: false; message: string; status: number }

export async function createInstantConsultReview(
  input: CreateInstantConsultReviewInput,
): Promise<CreateInstantConsultReviewResult> {
  const doctor = await prisma.doctorProfile.findFirst({
    where: { id: input.doctorId, deletedAt: null },
    select: { id: true },
  })
  if (!doctor) {
    return { ok: false, message: 'الطبيب غير موجود', status: 404 }
  }

  const consult = await prisma.instantConsultRequest.findFirst({
    where: {
      id: input.instantConsultId,
      doctorId: input.doctorId,
      status: InstantConsultStatus.COMPLETED,
      client: { userId: input.clientUserId },
    },
  })
  if (!consult) {
    return {
      ok: false,
      message: 'يمكن التقييم فقط بعد إتمام استشارة فورية مكتملة مع هذا الطبيب',
      status: 403,
    }
  }

  const existing = await prisma.review.findFirst({
    where: { instantConsultId: input.instantConsultId },
  })
  if (existing) {
    return { ok: false, message: 'لقد قمت بتقييم هذه الاستشارة مسبقاً', status: 409 }
  }

  const review = await prisma.review.create({
    data: {
      clientId: input.clientUserId,
      doctorId: input.doctorId,
      instantConsultId: input.instantConsultId,
      rating: input.rating,
      comment: input.comment,
    },
  })

  await refreshDoctorRatingStats(input.doctorId)
  notifyReviewReceived(review.id).catch(console.error)

  return { ok: true, reviewId: review.id, rating: review.rating }
}
