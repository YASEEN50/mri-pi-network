import { ApprovalStatus } from '@prisma/client'
import { prisma } from '../client'
import { IFacilityRepository, CreateFacilityData, FacilitySearchFilters } from '@/core/interfaces/repositories/facility.repository.interface'
import { FacilityEntity } from '@/core/domain/entities/facility'

function mapToEntity(raw: any): FacilityEntity {
  return FacilityEntity.create({
    id: raw.id, userId: raw.userId, name: raw.name, type: raw.type,
    description: raw.description ?? undefined,
    licenseNumber: raw.licenseNumber, licenseDocUrl: raw.licenseDocUrl,
    licenseExpiryDate: raw.licenseExpiryDate ?? undefined,
    approvalStatus: raw.approvalStatus, approvalNotes: raw.approvalNotes ?? undefined,
    approvedAt: raw.approvedAt ?? undefined, approvedBy: raw.approvedBy ?? undefined,
    phone: raw.phone ?? undefined, email: raw.email ?? undefined, website: raw.website ?? undefined,
    address: raw.address, city: raw.city, country: raw.country,
    latitude: raw.latitude ? Number(raw.latitude) : undefined,
    longitude: raw.longitude ? Number(raw.longitude) : undefined,
    totalReviews: raw.totalReviews, averageRating: Number(raw.averageRating),
    createdAt: raw.createdAt, updatedAt: raw.updatedAt,
  })
}

export class PrismaFacilityRepository implements IFacilityRepository {
  async findById(id: string) {
    const f = await prisma.facilityProfile.findUnique({ where: { id, deletedAt: null } })
    return f ? mapToEntity(f) : null
  }

  async findByUserId(userId: string) {
    const f = await prisma.facilityProfile.findUnique({ where: { userId, deletedAt: null } })
    return f ? mapToEntity(f) : null
  }

  async findByLicenseNumber(license: string) {
    const f = await prisma.facilityProfile.findUnique({ where: { licenseNumber: license.toUpperCase(), deletedAt: null } })
    return f ? mapToEntity(f) : null
  }

  async search(filters: FacilitySearchFilters) {
    const { type, city, approvalStatus, page = 1, limit = 20 } = filters
    const skip = (page - 1) * limit
    const where: any = { deletedAt: null }
    if (type)           where.type = type
    if (city)           where.city = { contains: city, mode: 'insensitive' }
    if (approvalStatus) where.approvalStatus = approvalStatus
    const [facilities, total] = await prisma.$transaction([
      prisma.facilityProfile.findMany({ where, skip, take: limit, orderBy: [{ averageRating: 'desc' }] }),
      prisma.facilityProfile.count({ where }),
    ])
    return { facilities: facilities.map(mapToEntity), total }
  }

  async create(data: CreateFacilityData) {
    const f = await prisma.facilityProfile.create({
      data: { ...data, licenseNumber: data.licenseNumber.toUpperCase(), approvalStatus: ApprovalStatus.DOCUMENTS_REVIEW },
    })
    return mapToEntity(f)
  }

  async updateApprovalStatus(facilityId: string, status: ApprovalStatus, adminId: string, notes?: string) {
    const f = await prisma.facilityProfile.update({
      where: { id: facilityId },
      data: { approvalStatus: status, approvedBy: adminId, approvedAt: status === ApprovalStatus.APPROVED ? new Date() : undefined, approvalNotes: notes ?? null, updatedAt: new Date() },
    })
    return mapToEntity(f)
  }

  async updateStats(facilityId: string, stats: { totalReviews?: number; averageRating?: number }) {
    await prisma.facilityProfile.update({
      where: { id: facilityId },
      data: { ...(stats.totalReviews !== undefined && { totalReviews: stats.totalReviews }), ...(stats.averageRating !== undefined && { averageRating: stats.averageRating }), updatedAt: new Date() },
    })
  }

  async softDelete(id: string) {
    await prisma.facilityProfile.update({ where: { id }, data: { deletedAt: new Date() } })
  }
}
