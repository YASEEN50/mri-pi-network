// =============================================================================
// src/core/use-cases/appointment/create-appointment.use-case.ts
// =============================================================================

import { IAppointmentRepository } from '@/core/interfaces/repositories/appointment.repository.interface'
import { IDoctorRepository } from '@/core/interfaces/repositories/doctor.repository.interface'
import { AppointmentEntity } from '@/core/domain/entities/appointment'
import { AppointmentType } from '@prisma/client'
import {
  Result, success, failure,
  ValidationError, NotFoundError, ConflictError,
  BusinessRuleError, InternalError
} from '@/core/errors'

export interface CreateAppointmentInput {
  clientId: string
  doctorId?: string
  facilityId?: string
  type: AppointmentType
  scheduledAt: Date
  duration?: number
  reason?: string
  notes?: string
}

export type CreateAppointmentResult = Result<
  AppointmentEntity,
  ValidationError | NotFoundError | ConflictError | BusinessRuleError | InternalError
>

export class CreateAppointmentUseCase {
  constructor(
    private readonly appointmentRepo: IAppointmentRepository,
    private readonly doctorRepo: IDoctorRepository
  ) {}

  async execute(input: CreateAppointmentInput): Promise<CreateAppointmentResult> {
    // التحقق من وجود طبيب أو منشأة
    if (!input.doctorId && !input.facilityId) {
      return failure(new ValidationError('يجب تحديد طبيب أو منشأة للموعد'))
    }

    // التحقق من التاريخ
    if (input.scheduledAt <= new Date()) {
      return failure(new ValidationError('يجب أن يكون موعد الحجز في المستقبل'))
    }

    // التحقق من أن الطبيب معتمد
    if (input.doctorId) {
      const doctor = await this.doctorRepo.findById(input.doctorId)
      if (!doctor) {
        return failure(new NotFoundError('الطبيب', input.doctorId))
      }
      if (!doctor.canAcceptAppointments()) {
        return failure(new BusinessRuleError('هذا الطبيب غير متاح لقبول المواعيد حالياً'))
      }
    }

    // التحقق من عدم وجود تعارض في المواعيد
    const duration = input.duration ?? 30
    const hasConflict = await this.appointmentRepo.hasConflict({
      doctorId: input.doctorId,
      facilityId: input.facilityId,
      scheduledAt: input.scheduledAt,
      duration,
    })

    if (hasConflict) {
      return failure(new ConflictError('هذا الوقت محجوز بالفعل، يرجى اختيار وقت آخر'))
    }

    try {
      const appointment = await this.appointmentRepo.create({
        clientId: input.clientId,
        doctorId: input.doctorId,
        facilityId: input.facilityId,
        type: input.type,
        scheduledAt: input.scheduledAt,
        duration,
        reason: input.reason,
        notes: input.notes,
      })

      return success(appointment)
    } catch (err) {
      return failure(new InternalError('فشل إنشاء الموعد', err))
    }
  }
}

// =============================================================================
// src/core/use-cases/review/add-review.use-case.ts
// =============================================================================

import { prisma } from '@/lib/prisma'
import { AppointmentStatus } from '@prisma/client'

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
  ValidationError | NotFoundError | ConflictError | BusinessRuleError | InternalError
>

export class AddReviewUseCase {
  async execute(input: AddReviewInput): Promise<AddReviewResult> {
    // التحقق من التقييم
    if (input.rating < 1 || input.rating > 5 || !Number.isInteger(input.rating)) {
      return failure(new ValidationError('التقييم يجب أن يكون رقماً صحيحاً بين 1 و 5'))
    }

    // التحقق من وجود الموعد وأنه مكتمل
    const appointment = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      include: { review: true },
    })

    if (!appointment) {
      return failure(new NotFoundError('الموعد', input.appointmentId))
    }

    // التحقق من ملكية الموعد
    if (appointment.clientId !== input.clientId) {
      return failure(new BusinessRuleError('لا يمكنك تقييم موعد لا يخصك'))
    }

    // التحقق من اكتمال الموعد
    if (appointment.status !== AppointmentStatus.COMPLETED) {
      return failure(new BusinessRuleError('يمكن تقييم المواعيد المكتملة فقط'))
    }

    // التحقق من عدم وجود تقييم مسبق
    if (appointment.review) {
      return failure(new ConflictError('لقد قمت بتقييم هذا الموعد مسبقاً'))
    }

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

      // تحديث إحصائيات الطبيب
      if (appointment.doctorId) {
        const stats = await prisma.review.aggregate({
          where: { doctorId: appointment.doctorId, isVisible: true },
          _avg: { rating: true },
          _count: { rating: true },
        })
        await prisma.doctorProfile.update({
          where: { id: appointment.doctorId },
          data: {
            averageRating: stats._avg.rating ?? 0,
            totalReviews: stats._count.rating,
          },
        })
      }

      // تحديث إحصائيات المنشأة
      if (appointment.facilityId) {
        const stats = await prisma.review.aggregate({
          where: { facilityId: appointment.facilityId, isVisible: true },
          _avg: { rating: true },
          _count: { rating: true },
        })
        await prisma.facilityProfile.update({
          where: { id: appointment.facilityId },
          data: {
            averageRating: stats._avg.rating ?? 0,
            totalReviews: stats._count.rating,
          },
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
