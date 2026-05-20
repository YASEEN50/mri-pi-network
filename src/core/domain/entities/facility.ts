// =============================================================================
// src/core/domain/entities/facility.ts
// =============================================================================

import { ApprovalStatus, FacilityType } from '@prisma/client'
import { BusinessRuleError } from '@/core/errors'

export interface FacilityProps {
  id: string
  userId: string
  name: string
  type: FacilityType
  description?: string
  licenseNumber: string
  licenseDocUrl: string
  licenseExpiryDate?: Date
  approvalStatus: ApprovalStatus
  approvalNotes?: string
  approvedAt?: Date
  approvedBy?: string
  phone?: string
  email?: string
  website?: string
  address: string
  city: string
  country: string
  latitude?: number
  longitude?: number
  totalReviews: number
  averageRating: number
  createdAt: Date
  updatedAt: Date
}

export class FacilityEntity {
  private constructor(private props: FacilityProps) {}

  static create(props: FacilityProps): FacilityEntity {
    return new FacilityEntity(props)
  }

  get id(): string                  { return this.props.id }
  get userId(): string              { return this.props.userId }
  get name(): string                { return this.props.name }
  get type(): FacilityType          { return this.props.type }
  get licenseNumber(): string       { return this.props.licenseNumber }
  get licenseDocUrl(): string       { return this.props.licenseDocUrl }
  get approvalStatus(): ApprovalStatus { return this.props.approvalStatus }
  get approvalNotes(): string | undefined { return this.props.approvalNotes }
  get address(): string             { return this.props.address }
  get city(): string                { return this.props.city }
  get country(): string             { return this.props.country }
  get totalReviews(): number        { return this.props.totalReviews }
  get averageRating(): number       { return this.props.averageRating }

  isPending(): boolean     { return this.props.approvalStatus === ApprovalStatus.PENDING }
  isUnderReview(): boolean { return this.props.approvalStatus === ApprovalStatus.DOCUMENTS_REVIEW }
  isApproved(): boolean    { return this.props.approvalStatus === ApprovalStatus.APPROVED }
  isRejected(): boolean    { return this.props.approvalStatus === ApprovalStatus.REJECTED }

  approve(adminId: string): void {
    if (!this.isUnderReview()) {
      throw new BusinessRuleError('يمكن الموافقة فقط على الطلبات تحت المراجعة')
    }
    this.props.approvalStatus = ApprovalStatus.APPROVED
    this.props.approvedBy = adminId
    this.props.approvedAt = new Date()
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

  submitForReview(): void {
    if (!this.isPending()) {
      throw new BusinessRuleError('يمكن تقديم الطلب فقط من حالة الانتظار')
    }
    this.props.approvalStatus = ApprovalStatus.DOCUMENTS_REVIEW
  }
}
