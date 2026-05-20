// =============================================================================
// src/core/use-cases/doctor/approve-doctor.use-case.ts
// =============================================================================

import { IDoctorRepository } from '@/core/interfaces/repositories/doctor.repository.interface'
import { DoctorEntity } from '@/core/domain/entities/doctor'
import { IUserRepository } from '@/core/interfaces/repositories/user.repository.interface'
import {
  Result, success, failure,
  NotFoundError, ForbiddenError, BusinessRuleError, InternalError
} from '@/core/errors'
import { ApprovalStatus } from '@prisma/client'

// --- Approve ---

export interface ApproveDoctorInput {
  doctorId: string
  adminId: string
}

export type ApproveDoctorResult = Result<
  DoctorEntity,
  NotFoundError | ForbiddenError | BusinessRuleError | InternalError
>

export class ApproveDoctorUseCase {
  constructor(
    private readonly doctorRepo: IDoctorRepository,
    private readonly userRepo: IUserRepository
  ) {}

  async execute(input: ApproveDoctorInput): Promise<ApproveDoctorResult> {
    // التحقق من أن المنفذ Admin
    const admin = await this.userRepo.findById(input.adminId)
    if (!admin || !admin.isAdmin()) {
      return failure(new ForbiddenError('فقط المشرفون يمكنهم الموافقة على طلبات الأطباء'))
    }

    const doctor = await this.doctorRepo.findById(input.doctorId)
    if (!doctor) {
      return failure(new NotFoundError('الطبيب', input.doctorId))
    }

    try {
      doctor.approve(input.adminId)
      const updated = await this.doctorRepo.updateApprovalStatus(
        doctor.id,
        ApprovalStatus.APPROVED,
        input.adminId
      )
      return success(updated)
    } catch (err) {
      if (err instanceof BusinessRuleError) return failure(err)
      return failure(new InternalError('فشل تحديث حالة الطبيب', err))
    }
  }
}

// --- Reject ---

export interface RejectDoctorInput {
  doctorId: string
  adminId: string
  notes: string
}

export type RejectDoctorResult = Result<
  DoctorEntity,
  NotFoundError | ForbiddenError | BusinessRuleError | InternalError
>

export class RejectDoctorUseCase {
  constructor(
    private readonly doctorRepo: IDoctorRepository,
    private readonly userRepo: IUserRepository
  ) {}

  async execute(input: RejectDoctorInput): Promise<RejectDoctorResult> {
    const admin = await this.userRepo.findById(input.adminId)
    if (!admin || !admin.isAdmin()) {
      return failure(new ForbiddenError('فقط المشرفون يمكنهم رفض طلبات الأطباء'))
    }

    const doctor = await this.doctorRepo.findById(input.doctorId)
    if (!doctor) {
      return failure(new NotFoundError('الطبيب', input.doctorId))
    }

    try {
      doctor.reject(input.adminId, input.notes)
      const updated = await this.doctorRepo.updateApprovalStatus(
        doctor.id,
        ApprovalStatus.REJECTED,
        input.adminId,
        input.notes
      )
      return success(updated)
    } catch (err) {
      if (err instanceof BusinessRuleError) return failure(err)
      return failure(new InternalError('فشل تحديث حالة الطبيب', err))
    }
  }
}
