// =============================================================================
// src/core/use-cases/doctor/register-doctor.use-case.ts
// =============================================================================

import { prisma } from '@/lib/prisma'
import { IFileStorage } from '@/core/interfaces/services/file-storage.interface'
import { IDoctorRepository } from '@/core/interfaces/repositories/doctor.repository.interface'
import { DoctorEntity } from '@/core/domain/entities/doctor'
import { LicenseNumber } from '@/core/domain/value-objects/license-number'
import { MedicalDegree, DegreeLevel } from '@/core/domain/value-objects/medical-degree'
import {
  Result, success, failure,
  ValidationError, ConflictError, InternalError, StorageError
} from '@/core/errors'
import { ApprovalStatus } from '@prisma/client'

export interface RegisterDoctorInput {
  userId: string
  firstName: string
  lastName: string
  specialization: string
  subSpecialization?: string
  licenseNumber: string
  licenseFile: Buffer           // ملف الرخصة
  licenseFileMime: 'image/jpeg' | 'image/png' | 'application/pdf'
  licenseExpiryDate?: Date
  yearsOfExperience: number
  languages?: string[]
  city?: string
  country?: string
  consultationFee?: number
  bio?: string
  credentials: Array<{
    title: string
    institution: string
    country: string
    year: number
    level: DegreeLevel
    file: Buffer
    fileMime: 'image/jpeg' | 'image/png' | 'application/pdf'
  }>
}

export type RegisterDoctorResult = Result<
  DoctorEntity,
  ValidationError | ConflictError | StorageError | InternalError
>

export class RegisterDoctorUseCase {
  constructor(
    private readonly doctorRepo: IDoctorRepository,
    private readonly fileStorage: IFileStorage
  ) {}

  async execute(input: RegisterDoctorInput): Promise<RegisterDoctorResult> {
    // 1. التحقق من الحقول المطلوبة
    if (!input.firstName.trim() || !input.lastName.trim()) {
      return failure(new ValidationError('الاسم الأول والأخير مطلوبان'))
    }
    if (!input.specialization.trim()) {
      return failure(new ValidationError('التخصص مطلوب'))
    }
    if (input.credentials.length === 0) {
      return failure(new ValidationError('يجب رفع شهادة علمية واحدة على الأقل'))
    }

    // 2. التحقق من رقم الرخصة
    let licenseNumber: LicenseNumber
    try {
      licenseNumber = LicenseNumber.create(input.licenseNumber)
    } catch (err) {
      if (err instanceof ValidationError) return failure(err)
      return failure(new InternalError('خطأ في التحقق من رقم الرخصة', err))
    }

    // 3. التحقق من عدم تكرار رقم الرخصة
    const existingByLicense = await this.doctorRepo.findByLicenseNumber(licenseNumber.value)
    if (existingByLicense) {
      return failure(new ConflictError('رقم الرخصة مسجل مسبقاً'))
    }

    // 4. التحقق من عدم وجود profile مسبق
    const existingProfile = await this.doctorRepo.findByUserId(input.userId)
    if (existingProfile) {
      return failure(new ConflictError('هذا المستخدم لديه ملف طبيب بالفعل'))
    }

    // 5. رفع صورة الرخصة
    let licenseImageUrl: string
    try {
      const uploaded = await this.fileStorage.upload(input.licenseFile, {
        folder: 'licenses',
        mimeType: input.licenseFileMime,
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      })
      licenseImageUrl = uploaded.url
    } catch {
      return failure(new StorageError('فشل رفع صورة الرخصة'))
    }

    // 6. رفع الشهادات وإنشاء Value Objects
    const uploadedCredentials: Array<{ degree: MedicalDegree; documentUrl: string }> = []

    for (const cred of input.credentials) {
      let documentUrl: string
      try {
        const uploaded = await this.fileStorage.upload(cred.file, {
          folder: 'credentials',
          mimeType: cred.fileMime,
          maxSizeBytes: 10 * 1024 * 1024,
        })
        documentUrl = uploaded.url
      } catch {
        return failure(new StorageError(`فشل رفع شهادة: ${cred.title}`))
      }

      try {
        const degree = MedicalDegree.create({
          title: cred.title,
          institution: cred.institution,
          country: cred.country,
          year: cred.year,
          level: cred.level,
          documentUrl,
        })
        uploadedCredentials.push({ degree, documentUrl })
      } catch (err) {
        if (err instanceof ValidationError) return failure(err)
        return failure(new InternalError('خطأ في التحقق من بيانات الشهادة', err))
      }
    }

    // 7. إنشاء الطبيب في قاعدة البيانات
    try {
      const doctor = await this.doctorRepo.create({
        userId: input.userId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        specialization: input.specialization.trim(),
        subSpecialization: input.subSpecialization?.trim(),
        licenseNumber: licenseNumber.value,
        licenseImageUrl,
        licenseExpiryDate: input.licenseExpiryDate,
        yearsOfExperience: input.yearsOfExperience,
        languages: input.languages ?? ['ar'],
        city: input.city,
        country: input.country ?? 'SA',
        consultationFee: input.consultationFee,
        bio: input.bio?.trim(),
      })

      // 8. إضافة الشهادات
      for (const { degree } of uploadedCredentials) {
        await this.doctorRepo.addCredential({
          doctorId: doctor.id,
          title: degree.title,
          institution: degree.institution,
          country: degree.country,
          year: degree.year,
          documentUrl: degree.documentUrl,
        })
        doctor.addCredential(degree)
      }

      // 9. تحويل الحالة لـ DOCUMENTS_REVIEW تلقائياً
      doctor.submitForReview()
      await this.doctorRepo.updateApprovalStatus(
        doctor.id,
        ApprovalStatus.DOCUMENTS_REVIEW,
        'system'
      )

      return success(doctor)
    } catch (err) {
      return failure(new InternalError('فشل إنشاء ملف الطبيب', err))
    }
  }
}
