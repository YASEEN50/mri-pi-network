// =============================================================================
// src/core/interfaces/repositories/doctor.repository.interface.ts
// =============================================================================

import { DoctorEntity } from '@/core/domain/entities/doctor'
import { ApprovalStatus } from '@prisma/client'

export interface CreateDoctorData {
  userId: string
  firstName: string
  lastName: string
  specialization: string
  subSpecialization?: string
  licenseNumber: string
  licenseImageUrl: string
  licenseExpiryDate?: Date
  yearsOfExperience: number
  languages: string[]
  city?: string
  country: string
  consultationFee?: number
  bio?: string
}

export interface CreateCredentialData {
  doctorId: string
  title: string
  institution: string
  country: string
  year: number
  documentUrl: string
}

export interface DoctorSearchFilters {
  specialization?: string
  city?: string
  approvalStatus?: ApprovalStatus
  minRating?: number
  page?: number
  limit?: number
}

export interface IDoctorRepository {
  findById(id: string): Promise<DoctorEntity | null>
  findByUserId(userId: string): Promise<DoctorEntity | null>
  findByLicenseNumber(license: string): Promise<DoctorEntity | null>
  search(filters: DoctorSearchFilters): Promise<{ doctors: DoctorEntity[]; total: number }>
  create(data: CreateDoctorData): Promise<DoctorEntity>
  addCredential(data: CreateCredentialData): Promise<void>
  updateApprovalStatus(
    doctorId: string,
    status: ApprovalStatus,
    adminId: string,
    notes?: string
  ): Promise<DoctorEntity>
  updateStats(doctorId: string, stats: { totalReviews?: number; averageRating?: number; totalAppointments?: number }): Promise<void>
  softDelete(doctorId: string): Promise<void>
}

// =============================================================================
// src/core/interfaces/repositories/appointment.repository.interface.ts
// =============================================================================

import { AppointmentEntity } from '@/core/domain/entities/appointment'
import { AppointmentStatus, AppointmentType } from '@prisma/client'

export interface CreateAppointmentData {
  clientId: string
  doctorId?: string
  facilityId?: string
  type: AppointmentType
  scheduledAt: Date
  duration: number
  reason?: string
  notes?: string
  fee?: number
}

export interface AppointmentFilters {
  clientId?: string
  doctorId?: string
  facilityId?: string
  status?: AppointmentStatus
  fromDate?: Date
  toDate?: Date
  page?: number
  limit?: number
}

export interface IAppointmentRepository {
  findById(id: string): Promise<AppointmentEntity | null>
  findMany(filters: AppointmentFilters): Promise<{ appointments: AppointmentEntity[]; total: number }>
  create(data: CreateAppointmentData): Promise<AppointmentEntity>
  updateStatus(
    appointmentId: string,
    status: AppointmentStatus,
    meta?: { cancelledBy?: string; cancelReason?: string; doctorNotes?: string }
  ): Promise<AppointmentEntity>
  hasConflict(params: { doctorId?: string; facilityId?: string; scheduledAt: Date; duration: number; excludeId?: string }): Promise<boolean>
  markAsPaid(appointmentId: string): Promise<void>
}
