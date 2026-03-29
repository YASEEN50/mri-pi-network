// =============================================================================
// src/infrastructure/database/prisma/repositories/doctor.repository.ts
// IDoctorRepository — Prisma implementation
// =============================================================================

import { ApprovalStatus } from '@prisma/client'
import { prisma } from '../client'
import {
  IDoctorRepository,
  CreateDoctorData,
  CreateCredentialData,
  DoctorSearchFilters,
} from '@/core/interfaces/repositories/doctor.repository.interface'
import { DoctorEntity } from '@/core/domain/entities/doctor'
import { LicenseNumber } from '@/core/domain/value-objects/license-number'
import { MedicalDegree } from '@/core/domain/value-objects/medical-degree'

// =============================================================================
// Mapper
// =============================================================================

function mapToEntity(
  raw: any,
  credentials: any[] = []
): DoctorEntity {
  return DoctorEntity.create({
    id: raw.id,
    userId: raw.userId,
    firstName: raw.firstName,
    lastName: raw.lastName,
    specialization: raw.specialization,
    subSpecialization: raw.subSpecialization ?? undefined,
    licenseNumber: LicenseNumber.create(raw.licenseNumber),
    licenseImageUrl: raw.licenseImageUrl,
    licenseExpiryDate: raw.licenseExpiryDate ?? undefined,
    credentials: credentials.map((c) =>
      MedicalDegree.create({
        title: c.title,
        institution: c.institution,
        country: c.country,
        year: c.year,
        level: c.level ?? 'BACHELOR',
        documentUrl: c.documentUrl,
      })
    ),
    approvalStatus: raw.approvalStatus,
    approvalNotes: raw.approvalNotes ?? undefined,
    approvedAt: raw.approvedAt ?? undefined,
    approvedBy: raw.approvedBy ?? undefined,
    yearsOfExperience: raw.yearsOfExperience,
    languages: raw.languages,
    city: raw.city ?? undefined,
    country: raw.country,
    consultationFee: raw.consultationFee ? Number(raw.consultationFee) : undefined,
    totalReviews: raw.totalReviews,
    averageRating: Number(raw.averageRating),
    totalAppointments: raw.totalAppointments,
    piKycVerified: raw.piKycVerified,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  })
}

// =============================================================================
// Repository
// =============================================================================

export class PrismaDoctorRepository implements IDoctorRepository {
  async findById(id: string): Promise<DoctorEntity | null> {
    const doc = await prisma.doctorProfile.findUnique({
      where: { id, deletedAt: null },
      include: { credentials: { where: { deletedAt: null } } },
    })
    return doc ? mapToEntity(doc, doc.credentials) : null
  }

  async findByUserId(userId: string): Promise<DoctorEntity | null> {
    const doc = await prisma.doctorProfile.findUnique({
      where: { userId, deletedAt: null },
      include: { credentials: { where: { deletedAt: null } } },
    })
    return doc ? mapToEntity(doc, doc.credentials) : null
  }

  async findByLicenseNumber(license: string): Promise<DoctorEntity | null> {
    const doc = await prisma.doctorProfile.findUnique({
      where: { licenseNumber: license, deletedAt: null },
      include: { credentials: { where: { deletedAt: null } } },
    })
    return doc ? mapToEntity(doc, doc.credentials) : null
  }

  async search(
    filters: DoctorSearchFilters
  ): Promise<{ doctors: DoctorEntity[]; total: number }> {
    const { specialization, city, approvalStatus, minRating, page = 1, limit = 20 } = filters
    const skip = (page - 1) * limit

    const where: any = { deletedAt: null }
    if (specialization) where.specialization = { contains: specialization, mode: 'insensitive' }
    if (city) where.city = { contains: city, mode: 'insensitive' }
    if (approvalStatus) where.approvalStatus = approvalStatus
    if (minRating) where.averageRating = { gte: minRating }

    const [docs, total] = await prisma.$transaction([
      prisma.doctorProfile.findMany({
        where,
        include: { credentials: { where: { deletedAt: null } } },
        skip,
        take: limit,
        orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }],
      }),
      prisma.doctorProfile.count({ where }),
    ])

    return {
      doctors: docs.map((d) => mapToEntity(d, d.credentials)),
      total,
    }
  }

  async create(data: CreateDoctorData): Promise<DoctorEntity> {
    const doc = await prisma.doctorProfile.create({
      data: {
        userId: data.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        specialization: data.specialization,
        subSpecialization: data.subSpecialization,
        licenseNumber: data.licenseNumber,
        licenseImageUrl: data.licenseImageUrl,
        licenseExpiryDate: data.licenseExpiryDate,
        yearsOfExperience: data.yearsOfExperience,
        languages: data.languages,
        city: data.city,
        country: data.country,
        consultationFee: data.consultationFee,
        bio: data.bio,
        approvalStatus: ApprovalStatus.PENDING,
      },
    })
    return mapToEntity(doc, [])
  }

  async addCredential(data: CreateCredentialData): Promise<void> {
    await prisma.doctorCredential.create({
      data: {
        doctorId: data.doctorId,
        title: data.title,
        institution: data.institution,
        country: data.country,
        year: data.year,
        documentUrl: data.documentUrl,
      },
    })
  }

  async updateApprovalStatus(
    doctorId: string,
    status: ApprovalStatus,
    adminId: string,
    notes?: string
  ): Promise<DoctorEntity> {
    const doc = await prisma.doctorProfile.update({
      where: { id: doctorId },
      data: {
        approvalStatus: status,
        approvedBy: adminId,
        approvedAt: status === ApprovalStatus.APPROVED ? new Date() : undefined,
        approvalNotes: notes ?? null,
        updatedAt: new Date(),
      },
      include: { credentials: { where: { deletedAt: null } } },
    })
    return mapToEntity(doc, doc.credentials)
  }

  async updateStats(
    doctorId: string,
    stats: { totalReviews?: number; averageRating?: number; totalAppointments?: number }
  ): Promise<void> {
    await prisma.doctorProfile.update({
      where: { id: doctorId },
      data: {
        ...(stats.totalReviews !== undefined && { totalReviews: stats.totalReviews }),
        ...(stats.averageRating !== undefined && { averageRating: stats.averageRating }),
        ...(stats.totalAppointments !== undefined && { totalAppointments: stats.totalAppointments }),
        updatedAt: new Date(),
      },
    })
  }

  async softDelete(doctorId: string): Promise<void> {
    await prisma.doctorProfile.update({
      where: { id: doctorId },
      data: { deletedAt: new Date() },
    })
  }
}
