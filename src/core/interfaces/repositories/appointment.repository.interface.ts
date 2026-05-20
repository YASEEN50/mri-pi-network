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
  hasConflict(params: {
    doctorId?: string
    facilityId?: string
    scheduledAt: Date
    duration: number
    excludeId?: string
  }): Promise<boolean>
  markAsPaid(appointmentId: string): Promise<void>
}
