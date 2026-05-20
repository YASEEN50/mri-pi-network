// =============================================================================
// src/core/domain/entities/doctor.ts
// =============================================================================

import { ApprovalStatus } from '@prisma/client'
import { LicenseNumber } from '../value-objects/license-number'
import { MedicalDegree } from '../value-objects/medical-degree'
import { BusinessRuleError } from '@/core/errors'

export interface DoctorProps {
  id: string
  userId: string
  firstName: string
  lastName: string
  specialization: string
  subSpecialization?: string
  licenseNumber: LicenseNumber
  licenseImageUrl: string
  licenseExpiryDate?: Date
  credentials: MedicalDegree[]
  approvalStatus: ApprovalStatus
  approvalNotes?: string
  approvedAt?: Date
  approvedBy?: string
  yearsOfExperience: number
  languages: string[]
  city?: string
  country: string
  consultationFee?: number
  totalReviews: number
  averageRating: number
  totalAppointments: number
  piKycVerified: boolean
  createdAt: Date
  updatedAt: Date
}

export class DoctorEntity {
  private constructor(private props: DoctorProps) {}

  static create(props: DoctorProps): DoctorEntity {
    return new DoctorEntity(props)
  }

  // Getters
  get id(): string                      { return this.props.id }
  get userId(): string                  { return this.props.userId }
  get firstName(): string               { return this.props.firstName }
  get lastName(): string                { return this.props.lastName }
  get fullName(): string                { return `${this.props.firstName} ${this.props.lastName}` }
  get specialization(): string          { return this.props.specialization }
  get licenseNumber(): LicenseNumber    { return this.props.licenseNumber }
  get licenseImageUrl(): string         { return this.props.licenseImageUrl }
  get credentials(): MedicalDegree[]   { return this.props.credentials }
  get approvalStatus(): ApprovalStatus { return this.props.approvalStatus }
  get approvalNotes(): string | undefined { return this.props.approvalNotes }
  get yearsOfExperience(): number       { return this.props.yearsOfExperience }
  get consultationFee(): number | undefined { return this.props.consultationFee }
  get totalReviews(): number            { return this.props.totalReviews }
  get averageRating(): number           { return this.props.averageRating }
  get city(): string | undefined        { return this.props.city }
  get country(): string                 { return this.props.country }

  // Business Rules
  isPending(): boolean         { return this.props.approvalStatus === ApprovalStatus.PENDING }
  isUnderReview(): boolean     { return this.props.approvalStatus === ApprovalStatus.DOCUMENTS_REVIEW }
  isApproved(): boolean        { return this.props.approvalStatus === ApprovalStatus.APPROVED }
  isRejected(): boolean        { return this.props.approvalStatus === ApprovalStatus.REJECTED }

  canAcceptAppointments(): boolean {
    return this.isApproved()
  }

  hasMinimumCredentials(): boolean {
    return this.props.credentials.length >= 1
  }

  // Approval flow
  submitForReview(): void {
    if (!this.isPending()) {
      throw new BusinessRuleError('يمكن تقديم الطلب فقط عندما يكون الحساب في حالة انتظار')
    }
    if (!this.hasMinimumCredentials()) {
      throw new BusinessRuleError('يجب رفع شهادة علمية واحدة على الأقل')
    }
    this.props.approvalStatus = ApprovalStatus.DOCUMENTS_REVIEW
  }

  approve(adminId: string): void {
    if (!this.isUnderReview()) {
      throw new BusinessRuleError('يمكن الموافقة فقط على الطلبات تحت المراجعة')
    }
    this.props.approvalStatus = ApprovalStatus.APPROVED
    this.props.approvedBy = adminId
    this.props.approvedAt = new Date()
    this.props.approvalNotes = undefined
  }

  reject(adminId: string, notes: string): void {
    if (!this.isUnderReview()) {
      throw new BusinessRuleError('يمكن رفض الطلبات تحت المراجعة فقط')
    }
    if (!notes.trim()) {
      throw new BusinessRuleError('يجب إدخال سبب الرفض')
    }
    this.props.approvalStatus = ApprovalStatus.REJECTED
    this.props.approvedBy = adminId
    this.props.approvalNotes = notes
  }

  addCredential(degree: MedicalDegree): void {
    this.props.credentials.push(degree)
  }
}
