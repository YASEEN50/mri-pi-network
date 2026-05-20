// =============================================================================
// src/core/use-cases/client/register-client.use-case.ts
// =============================================================================

import { prisma } from '@/lib/prisma'
import { ClientEntity } from '@/core/domain/entities/client'
import { Result, success, failure, ConflictError, ValidationError, InternalError } from '@/core/errors'

export interface RegisterClientInput {
  userId: string
  firstName: string
  lastName: string
  dateOfBirth?: Date
  gender?: string
  city?: string
  country?: string
  bloodType?: string
  allergies?: string[]
  chronicDiseases?: string[]
}

export type RegisterClientResult = Result<ClientEntity, ConflictError | ValidationError | InternalError>

export class RegisterClientUseCase {
  async execute(input: RegisterClientInput): Promise<RegisterClientResult> {
    // التحقق من عدم وجود profile مسبق
    const existing = await prisma.clientProfile.findUnique({
      where: { userId: input.userId },
    })
    if (existing) {
      return failure(new ConflictError('هذا المستخدم لديه ملف شخصي بالفعل'))
    }

    // التحقق من الحقول المطلوبة
    if (!input.firstName.trim() || !input.lastName.trim()) {
      return failure(new ValidationError('الاسم الأول والأخير مطلوبان'))
    }

    try {
      const profile = await prisma.clientProfile.create({
        data: {
          userId: input.userId,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          city: input.city,
          country: input.country ?? 'SA',
          bloodType: input.bloodType,
          allergies: input.allergies ?? [],
          chronicDiseases: input.chronicDiseases ?? [],
        },
      })

      const entity = ClientEntity.create({
        id: profile.id,
        userId: profile.userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        dateOfBirth: profile.dateOfBirth ?? undefined,
        gender: profile.gender ?? undefined,
        city: profile.city ?? undefined,
        country: profile.country,
        bloodType: profile.bloodType ?? undefined,
        allergies: profile.allergies,
        chronicDiseases: profile.chronicDiseases,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      })

      return success(entity)
    } catch (err) {
      return failure(new InternalError('فشل إنشاء الملف الشخصي', err))
    }
  }
}
