// src/lib/reviews/create-review.ts
// منطق مشترك لإنشاء تقييم — يتطلب موعداً مكتملاً

import { prisma } from '@/lib/prisma'
import { AppointmentStatus } from '@prisma/client'
import { notifyReviewReceived } from '@/lib/reviews/notifications'
import { refreshDoctorRatingStats } from '@/lib/reviews/update-doctor-rating'

export interface CreateReviewInput {
  clientUserId:  string
  doctorId:      string
  appointmentId: string
  rating:        number
  comment?:      string
}

export type CreateReviewResult =
  | { ok: true; reviewId: string; rating: number }
  | { ok: false; message: string; status: number }

export async function createDoctorReview(input: CreateReviewInput): Promise<CreateReviewResult> {
  const doctor = await prisma.doctorProfile.findFirst({
    where: { id: input.doctorId, deletedAt: null },
    select: { id: true },
  })
  if (!doctor) {
    return { ok: false, message: 'الطبيب غير موجود', status: 404 }
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      id:        input.appointmentId,
      clientId:  input.clientUserId,
      doctorId:  input.doctorId,
      status:    AppointmentStatus.COMPLETED,
      deletedAt: null,
    },
  })
  if (!appointment) {
    return {
      ok:      false,
      message: 'يمكن التقييم فقط بعد إتمام موعد مكتمل مع هذا الطبيب',
      status:  403,
    }
  }

  const existing = await prisma.review.findFirst({
    where: { appointmentId: input.appointmentId },
  })
  if (existing) {
    return { ok: false, message: 'لقد قمت بتقييم هذا الموعد مسبقاً', status: 409 }
  }

  const review = await prisma.review.create({
    data: {
      clientId:      input.clientUserId,
      doctorId:      input.doctorId,
      appointmentId: input.appointmentId,
      rating:        input.rating,
      comment:       input.comment,
    },
  })

  await refreshDoctorRatingStats(input.doctorId)

  notifyReviewReceived(review.id).catch(console.error)

  return { ok: true, reviewId: review.id, rating: review.rating }
}
