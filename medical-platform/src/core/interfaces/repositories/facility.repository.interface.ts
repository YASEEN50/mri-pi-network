import { FacilityEntity } from '@/core/domain/entities/facility'
import { ApprovalStatus, FacilityType } from '@prisma/client'

export interface CreateFacilityData {
  userId: string
  name: string
  type: FacilityType
  description?: string
  licenseNumber: string
  licenseDocUrl: string
  licenseExpiryDate?: Date
  phone?: string
  email?: string
  website?: string
  address: string
  city: string
  country: string
  latitude?: number
  longitude?: number
}

export interface FacilitySearchFilters {
  type?: FacilityType
  city?: string
  approvalStatus?: ApprovalStatus
  page?: number
  limit?: number
}

export interface IFacilityRepository {
  findById(id: string): Promise<FacilityEntity | null>
  findByUserId(userId: string): Promise<FacilityEntity | null>
  findByLicenseNumber(license: string): Promise<FacilityEntity | null>
  search(filters: FacilitySearchFilters): Promise<{ facilities: FacilityEntity[]; total: number }>
  create(data: CreateFacilityData): Promise<FacilityEntity>
  updateApprovalStatus(facilityId: string, status: ApprovalStatus, adminId: string, notes?: string): Promise<FacilityEntity>
  updateStats(facilityId: string, stats: { totalReviews?: number; averageRating?: number }): Promise<void>
  softDelete(id: string): Promise<void>
}
