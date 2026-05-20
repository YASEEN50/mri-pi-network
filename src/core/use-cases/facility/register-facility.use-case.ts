// =============================================================================
// src/core/use-cases/facility/register-facility.use-case.ts
// =============================================================================

import { IFileStorage } from '@/core/interfaces/services/file-storage.interface'
import { FacilityEntity } from '@/core/domain/entities/facility'
import { prisma } from '@/lib/prisma'
import { FacilityType, ApprovalStatus } from '@prisma/client'
import {
  Result, success, failure,
  ValidationError, ConflictError, StorageError, InternalError
} from '@/core/errors'

export interface RegisterFacilityInput {
  userId: string
  name: string
  type: FacilityType
  description?: string
  licenseNumber: string
  licenseFile: Buffer
  licenseFileMime: 'image/jpeg' | 'image/png' | 'application/pdf'
  licenseExpiryDate?: Date
  phone?: string
  email?: string
  website?: string
  address: string
  city: string
  country?: string
  latitude?: number
  longitude?: number
}

export type RegisterFacilityResult = Result<
  FacilityEntity,
  ValidationError | ConflictError | StorageError | InternalError
>

export class RegisterFacilityUseCase {
  constructor(private readonly fileStorage: IFileStorage) {}

  async execute(input: RegisterFacilityInput): Promise<RegisterFacilityResult> {
    // التحقق من الحقول المطلوبة
    if (!input.name.trim()) {
      return failure(new ValidationError('اسم المنشأة مطلوب'))
    }
    if (!input.address.trim() || !input.city.trim()) {
      return failure(new ValidationError('العنوان والمدينة مطلوبان'))
    }
    if (!input.licenseNumber.trim()) {
      return failure(new ValidationError('رقم الترخيص مطلوب'))
    }

    // التحقق من عدم التكرار
    const existingByLicense = await prisma.facilityProfile.findUnique({
      where: { licenseNumber: input.licenseNumber.trim().toUpperCase() },
    })
    if (existingByLicense) {
      return failure(new ConflictError('رقم الترخيص مسجل مسبقاً'))
    }

    const existingByUser = await prisma.facilityProfile.findUnique({
      where: { userId: input.userId },
    })
    if (existingByUser) {
      return failure(new ConflictError('هذا المستخدم لديه منشأة مسجلة بالفعل'))
    }

    // رفع وثيقة الترخيص
    let licenseDocUrl: string
    try {
      const uploaded = await this.fileStorage.upload(input.licenseFile, {
        folder: 'facility-docs',
        mimeType: input.licenseFileMime,
        maxSizeBytes: 10 * 1024 * 1024,
      })
      licenseDocUrl = uploaded.url
    } catch {
      return failure(new StorageError('فشل رفع وثيقة الترخيص'))
    }

    try {
      const profile = await prisma.facilityProfile.create({
        data: {
          userId: input.userId,
          name: input.name.trim(),
          type: input.type,
          description: input.description?.trim(),
          licenseNumber: input.licenseNumber.trim().toUpperCase(),
          licenseDocUrl,
          licenseExpiryDate: input.licenseExpiryDate,
          approvalStatus: ApprovalStatus.DOCUMENTS_REVIEW,
          phone: input.phone,
          email: input.email,
          website: input.website,
          address: input.address.trim(),
          city: input.city.trim(),
          country: input.country ?? 'SA',
          latitude: input.latitude,
          longitude: input.longitude,
        },
      })

      const entity = FacilityEntity.create({
        id: profile.id,
        userId: profile.userId,
        name: profile.name,
        type: profile.type,
        description: profile.description ?? undefined,
        licenseNumber: profile.licenseNumber,
        licenseDocUrl: profile.licenseDocUrl,
        licenseExpiryDate: profile.licenseExpiryDate ?? undefined,
        approvalStatus: profile.approvalStatus,
        phone: profile.phone ?? undefined,
        email: profile.email ?? undefined,
        website: profile.website ?? undefined,
        address: profile.address,
        city: profile.city,
        country: profile.country,
        latitude: profile.latitude ? Number(profile.latitude) : undefined,
        longitude: profile.longitude ? Number(profile.longitude) : undefined,
        totalReviews: profile.totalReviews,
        averageRating: Number(profile.averageRating),
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      })

      return success(entity)
    } catch (err) {
      return failure(new InternalError('فشل إنشاء ملف المنشأة', err))
    }
  }
}

// =============================================================================
// src/core/use-cases/facility/approve-facility.use-case.ts
// =============================================================================

import { IUserRepository } from '@/core/interfaces/repositories/user.repository.interface'
import {
  NotFoundError, ForbiddenError, BusinessRuleError
} from '@/core/errors'

export interface ApproveFacilityInput {
  facilityId: string
  adminId: string
}

export type ApproveFacilityResult = Result<
  FacilityEntity,
  NotFoundError | ForbiddenError | BusinessRuleError | InternalError
>

export class ApproveFacilityUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(input: ApproveFacilityInput): Promise<ApproveFacilityResult> {
    const admin = await this.userRepo.findById(input.adminId)
    if (!admin || !admin.isAdmin()) {
      return failure(new ForbiddenError('فقط المشرفون يمكنهم الموافقة على المنشآت'))
    }

    const profile = await prisma.facilityProfile.findUnique({
      where: { id: input.facilityId },
    })
    if (!profile) {
      return failure(new NotFoundError('المنشأة', input.facilityId))
    }

    if (profile.approvalStatus !== ApprovalStatus.DOCUMENTS_REVIEW) {
      return failure(new BusinessRuleError('يمكن الموافقة فقط على الطلبات تحت المراجعة'))
    }

    try {
      const updated = await prisma.facilityProfile.update({
        where: { id: input.facilityId },
        data: {
          approvalStatus: ApprovalStatus.APPROVED,
          approvedBy: input.adminId,
          approvedAt: new Date(),
          approvalNotes: null,
        },
      })

      const entity = FacilityEntity.create({
        id: updated.id,
        userId: updated.userId,
        name: updated.name,
        type: updated.type,
        licenseNumber: updated.licenseNumber,
        licenseDocUrl: updated.licenseDocUrl,
        approvalStatus: updated.approvalStatus,
        address: updated.address,
        city: updated.city,
        country: updated.country,
        totalReviews: updated.totalReviews,
        averageRating: Number(updated.averageRating),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      })

      return success(entity)
    } catch (err) {
      return failure(new InternalError('فشل تحديث حالة المنشأة', err))
    }
  }
}
