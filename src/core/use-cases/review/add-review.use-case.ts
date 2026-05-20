import { prisma } from '@/lib/prisma'
import { AppointmentStatus } from '@prisma/client'
import {
  Result, success, failure,
  ValidationError, NotFoundError, ConflictError,
  BusinessRuleError, ForbiddenError, InternalError,
} from '@/core/errors'

export interface AddReviewInput {
  clientId: string
  appointmentId: string
  rating: number
  comment?: string
}

export interface ReviewOutput {
  id: string
  clientId: string
  doctorId?: string
  facilityId?: string
  appointmentId: string
  rating: number
  comment?: string
  createdAt: Date
}

export type AddReviewResult = Result<
  ReviewOutput,
  ValidationError | NotFoundError | ConflictError | BusinessRuleError | ForbiddenError | InternalError
>

export class AddReviewUseCase {
  async execute(input: AddReviewInput): Promise<AddReviewResult> {
    if (input.rating < 1 || input.rating > 5 || !Number.isInteger(input.rating)) {
      return failure(new ValidationError('التقييم يجب أن يكون رقماً صحيحاً بين 1 و 5'))
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      include: { review: true },
    })

    if (!appointment) return failure(new NotFoundError('الموعد', input.appointmentId))
    if (appointment.clientId !== input.clientId) return failure(new ForbiddenError('لا يمكنك تقييم موعد لا يخصك'))
    if (appointment.status !== AppointmentStatus.COMPLETED) return failure(new BusinessRuleError('يمكن تقييم المواعيد المكتملة فقط'))
    if (appointment.review) return failure(new ConflictError('لقد قمت بتقييم هذا الموعد مسبقاً'))

    try {
      const review = await prisma.review.create({
        data: {
          clientId: input.clientId,
          doctorId: appointment.doctorId,
          facilityId: appointment.facilityId,
          appointmentId: input.appointmentId,
          rating: input.rating,
          comment: input.comment?.trim(),
        },
      })

      if (appointment.doctorId) {
        const stats = await prisma.review.aggregate({
          where: { doctorId: appointment.doctorId, isVisible: true },
          _avg: { rating: true }, _count: { rating: true },
        })
        await prisma.doctorProfile.update({
          where: { id: appointment.doctorId },
          data: { averageRating: stats._avg.rating ?? 0, totalReviews: stats._count.rating },
        })
      }

      if (appointment.facilityId) {
        const stats = await prisma.review.aggregate({
          where: { facilityId: appointment.facilityId, isVisible: true },
          _avg: { rating: true }, _count: { rating: true },
        })
        await prisma.facilityProfile.update({
          where: { id: appointment.facilityId },
          data: { averageRating: stats._avg.rating ?? 0, totalReviews: stats._count.rating },
        })
      }

      return success({
        id: review.id,
        clientId: review.clientId,
        doctorId: review.doctorId ?? undefined,
        facilityId: review.facilityId ?? undefined,
        appointmentId: review.appointmentId!,
        rating: review.rating,
        comment: review.comment ?? undefined,
        createdAt: review.createdAt,
      })
    } catch (err) {
      return failure(new InternalError('فشل إضافة التقييم', err))
    }
  }
}
