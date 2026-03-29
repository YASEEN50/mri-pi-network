// =============================================================================
// src/infrastructure/database/prisma/repositories/appointment.repository.ts
// IAppointmentRepository — Prisma implementation
// =============================================================================

import { AppointmentStatus, AppointmentType } from '@prisma/client'
import { prisma } from '../client'
import {
  IAppointmentRepository,
  CreateAppointmentData,
  AppointmentFilters,
} from '@/core/interfaces/repositories/appointment.repository.interface'
import { AppointmentEntity } from '@/core/domain/entities/appointment'

// =============================================================================
// Mapper
// =============================================================================

function mapToEntity(raw: any): AppointmentEntity {
  return AppointmentEntity.create({
    id: raw.id,
    clientId: raw.clientId,
    doctorId: raw.doctorId ?? undefined,
    facilityId: raw.facilityId ?? undefined,
    type: raw.type,
    status: raw.status,
    scheduledAt: raw.scheduledAt,
    duration: raw.duration,
    reason: raw.reason ?? undefined,
    notes: raw.notes ?? undefined,
    doctorNotes: raw.doctorNotes ?? undefined,
    cancelReason: raw.cancelReason ?? undefined,
    cancelledBy: raw.cancelledBy ?? undefined,
    fee: raw.fee ? Number(raw.fee) : undefined,
    isPaid: raw.isPaid,
    paidAt: raw.paidAt ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  })
}

// =============================================================================
// Repository
// =============================================================================

export class PrismaAppointmentRepository implements IAppointmentRepository {
  async findById(id: string): Promise<AppointmentEntity | null> {
    const a = await prisma.appointment.findUnique({
      where: { id, deletedAt: null },
    })
    return a ? mapToEntity(a) : null
  }

  async findMany(
    filters: AppointmentFilters
  ): Promise<{ appointments: AppointmentEntity[]; total: number }> {
    const { clientId, doctorId, facilityId, status, fromDate, toDate, page = 1, limit = 20 } = filters
    const skip = (page - 1) * limit

    const where: any = { deletedAt: null }
    if (clientId) where.clientId = clientId
    if (doctorId) where.doctorId = doctorId
    if (facilityId) where.facilityId = facilityId
    if (status) where.status = status
    if (fromDate || toDate) {
      where.scheduledAt = {}
      if (fromDate) where.scheduledAt.gte = fromDate
      if (toDate) where.scheduledAt.lte = toDate
    }

    const [appointments, total] = await prisma.$transaction([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
      }),
      prisma.appointment.count({ where }),
    ])

    return {
      appointments: appointments.map(mapToEntity),
      total,
    }
  }

  async create(data: CreateAppointmentData): Promise<AppointmentEntity> {
    const a = await prisma.appointment.create({
      data: {
        clientId: data.clientId,
        doctorId: data.doctorId,
        facilityId: data.facilityId,
        type: data.type,
        scheduledAt: data.scheduledAt,
        duration: data.duration,
        reason: data.reason,
        notes: data.notes,
        fee: data.fee,
        status: AppointmentStatus.PENDING,
      },
    })
    return mapToEntity(a)
  }

  async updateStatus(
    appointmentId: string,
    status: AppointmentStatus,
    meta?: { cancelledBy?: string; cancelReason?: string; doctorNotes?: string }
  ): Promise<AppointmentEntity> {
    const a = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status,
        ...(meta?.cancelledBy && { cancelledBy: meta.cancelledBy }),
        ...(meta?.cancelReason && { cancelReason: meta.cancelReason }),
        ...(meta?.doctorNotes && { doctorNotes: meta.doctorNotes }),
        updatedAt: new Date(),
      },
    })
    return mapToEntity(a)
  }

  async hasConflict(params: {
    doctorId?: string
    facilityId?: string
    scheduledAt: Date
    duration: number
    excludeId?: string
  }): Promise<boolean> {
    const { doctorId, facilityId, scheduledAt, duration, excludeId } = params

    // حساب نهاية الموعد الجديد
    const endTime = new Date(scheduledAt.getTime() + duration * 60 * 1000)

    const where: any = {
      deletedAt: null,
      status: { notIn: [AppointmentStatus.CANCELLED] },
      // تعارض: موعد موجود يتداخل مع النطاق الزمني الجديد
      scheduledAt: { lt: endTime },
      AND: [
        {
          // نهاية الموعد الموجود > بداية الموعد الجديد
          scheduledAt: {
            gt: new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000), // تقريب للبحث
          },
        },
      ],
    }

    if (excludeId) where.id = { not: excludeId }

    const orConditions: any[] = []
    if (doctorId) orConditions.push({ doctorId })
    if (facilityId) orConditions.push({ facilityId })

    if (orConditions.length === 0) return false

    // استخدام Raw Query لدقة أعلى في حساب التعارض
    const conflictQuery = doctorId
      ? await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count FROM appointments
          WHERE doctor_id = ${doctorId}
            AND deleted_at IS NULL
            AND status NOT IN ('CANCELLED')
            AND id != ${excludeId ?? ''}
            AND scheduled_at < ${endTime}
            AND (scheduled_at + (duration * interval '1 minute')) > ${scheduledAt}
        `
      : await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count FROM appointments
          WHERE facility_id = ${facilityId}
            AND deleted_at IS NULL
            AND status NOT IN ('CANCELLED')
            AND id != ${excludeId ?? ''}
            AND scheduled_at < ${endTime}
            AND (scheduled_at + (duration * interval '1 minute')) > ${scheduledAt}
        `

    return Number(conflictQuery[0]?.count ?? 0) > 0
  }

  async markAsPaid(appointmentId: string): Promise<void> {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { isPaid: true, paidAt: new Date() },
    })
  }
}
