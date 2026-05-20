import { ReviewEntity } from '@/core/domain/entities/review'

export interface CreateReviewData {
  clientId: string
  doctorId?: string
  facilityId?: string
  appointmentId: string
  rating: number
  comment?: string
}

export interface ReviewFilters {
  doctorId?: string
  facilityId?: string
  clientId?: string
  isVisible?: boolean
  page?: number
  limit?: number
}

export interface IReviewRepository {
  findById(id: string): Promise<ReviewEntity | null>
  findByAppointmentId(appointmentId: string): Promise<ReviewEntity | null>
  findMany(filters: ReviewFilters): Promise<{ reviews: ReviewEntity[]; total: number }>
  create(data: CreateReviewData): Promise<ReviewEntity>
  hide(reviewId: string): Promise<void>
  getAverageRating(params: { doctorId?: string; facilityId?: string }): Promise<number>
}
