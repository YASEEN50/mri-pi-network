// =============================================================================
// src/infrastructure/database/prisma/repositories/client.repository.ts
// =============================================================================

import { prisma } from '../client'
import { ClientEntity } from '@/core/domain/entities/client'

export interface IClientRepository {
  findById(id: string): Promise<ClientEntity | null>
  findByUserId(userId: string): Promise<ClientEntity | null>
  create(data: {
    userId: string
    firstName: string
    lastName: string
    dateOfBirth?: Date
    gender?: string
    city?: string
    country: string
    bloodType?: string
    allergies: string[]
    chronicDiseases: string[]
  }): Promise<ClientEntity>
  update(id: string, data: Partial<{
    firstName: string
    lastName: string
    dateOfBirth: Date
    gender: string
    city: string
    bloodType: string
    allergies: string[]
    chronicDiseases: string[]
  }>): Promise<ClientEntity>
  softDelete(id: string): Promise<void>
}

function mapClient(raw: any): ClientEntity {
  return ClientEntity.create({
    id: raw.id,
    userId: raw.userId,
    firstName: raw.firstName,
    lastName: raw.lastName,
    dateOfBirth: raw.dateOfBirth ?? undefined,
    gender: raw.gender ?? undefined,
    city: raw.city ?? undefined,
    country: raw.country,
    bloodType: raw.bloodType ?? undefined,
    allergies: raw.allergies,
    chronicDiseases: raw.chronicDiseases,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  })
}

export class PrismaClientRepository implements IClientRepository {
  async findById(id: string): Promise<ClientEntity | null> {
    const c = await prisma.clientProfile.findUnique({ where: { id, deletedAt: null } })
    return c ? mapClient(c) : null
  }

  async findByUserId(userId: string): Promise<ClientEntity | null> {
    const c = await prisma.clientProfile.findUnique({ where: { userId, deletedAt: null } })
    return c ? mapClient(c) : null
  }

  async create(data: any): Promise<ClientEntity> {
    const c = await prisma.clientProfile.create({ data })
    return mapClient(c)
  }

  async update(id: string, data: any): Promise<ClientEntity> {
    const c = await prisma.clientProfile.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    })
    return mapClient(c)
  }

  async softDelete(id: string): Promise<void> {
    await prisma.clientProfile.update({ where: { id }, data: { deletedAt: new Date() } })
  }
}

// =============================================================================
// src/infrastructure/database/prisma/repositories/facility.repository.ts
// =============================================================================

import { ApprovalStatus, FacilityType } from '@prisma/client'
import { FacilityEntity } from '@/core/domain/entities/facility'

export interface IFacilityRepository {
  findById(id: string): Promise<FacilityEntity | null>
  findByUserId(userId: string): Promise<FacilityEntity | null>
  findByLicenseNumber(license: string): Promise<FacilityEntity | null>
  search(filters: {
    type?: FacilityType
    city?: string
    approvalStatus?: ApprovalStatus
    page?: number
    limit?: number
  }): Promise<{ facilities: FacilityEntity[]; total: number }>
  create(data: {
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
  }): Promise<FacilityEntity>
  updateApprovalStatus(
    facilityId: string,
    status: ApprovalStatus,
    adminId: string,
    notes?: string
  ): Promise<FacilityEntity>
  softDelete(id: string): Promise<void>
}

function mapFacility(raw: any): FacilityEntity {
  return FacilityEntity.create({
    id: raw.id,
    userId: raw.userId,
    name: raw.name,
    type: raw.type,
    description: raw.description ?? undefined,
    licenseNumber: raw.licenseNumber,
    licenseDocUrl: raw.licenseDocUrl,
    licenseExpiryDate: raw.licenseExpiryDate ?? undefined,
    approvalStatus: raw.approvalStatus,
    approvalNotes: raw.approvalNotes ?? undefined,
    approvedAt: raw.approvedAt ?? undefined,
    approvedBy: raw.approvedBy ?? undefined,
    phone: raw.phone ?? undefined,
    email: raw.email ?? undefined,
    website: raw.website ?? undefined,
    address: raw.address,
    city: raw.city,
    country: raw.country,
    latitude: raw.latitude ? Number(raw.latitude) : undefined,
    longitude: raw.longitude ? Number(raw.longitude) : undefined,
    totalReviews: raw.totalReviews,
    averageRating: Number(raw.averageRating),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  })
}

export class PrismaFacilityRepository implements IFacilityRepository {
  async findById(id: string): Promise<FacilityEntity | null> {
    const f = await prisma.facilityProfile.findUnique({ where: { id, deletedAt: null } })
    return f ? mapFacility(f) : null
  }

  async findByUserId(userId: string): Promise<FacilityEntity | null> {
    const f = await prisma.facilityProfile.findUnique({ where: { userId, deletedAt: null } })
    return f ? mapFacility(f) : null
  }

  async findByLicenseNumber(license: string): Promise<FacilityEntity | null> {
    const f = await prisma.facilityProfile.findUnique({
      where: { licenseNumber: license.toUpperCase(), deletedAt: null },
    })
    return f ? mapFacility(f) : null
  }

  async search(filters: any): Promise<{ facilities: FacilityEntity[]; total: number }> {
    const { type, city, approvalStatus, page = 1, limit = 20 } = filters
    const skip = (page - 1) * limit
    const where: any = { deletedAt: null }
    if (type) where.type = type
    if (city) where.city = { contains: city, mode: 'insensitive' }
    if (approvalStatus) where.approvalStatus = approvalStatus

    const [facilities, total] = await prisma.$transaction([
      prisma.facilityProfile.findMany({ where, skip, take: limit, orderBy: { averageRating: 'desc' } }),
      prisma.facilityProfile.count({ where }),
    ])
    return { facilities: facilities.map(mapFacility), total }
  }

  async create(data: any): Promise<FacilityEntity> {
    const f = await prisma.facilityProfile.create({
      data: { ...data, approvalStatus: ApprovalStatus.DOCUMENTS_REVIEW },
    })
    return mapFacility(f)
  }

  async updateApprovalStatus(
    facilityId: string,
    status: ApprovalStatus,
    adminId: string,
    notes?: string
  ): Promise<FacilityEntity> {
    const f = await prisma.facilityProfile.update({
      where: { id: facilityId },
      data: {
        approvalStatus: status,
        approvedBy: adminId,
        approvedAt: status === ApprovalStatus.APPROVED ? new Date() : undefined,
        approvalNotes: notes ?? null,
        updatedAt: new Date(),
      },
    })
    return mapFacility(f)
  }

  async softDelete(id: string): Promise<void> {
    await prisma.facilityProfile.update({ where: { id }, data: { deletedAt: new Date() } })
  }
}
