// =============================================================================
// src/core/domain/entities/appointment.ts
// =============================================================================

import { AppointmentStatus, AppointmentType } from '@prisma/client'
import { BusinessRuleError } from '@/core/errors'

export interface AppointmentProps {
  id: string
  clientId: string
  doctorId?: string
  facilityId?: string
  type: AppointmentType
  status: AppointmentStatus
  scheduledAt: Date
  duration: number
  reason?: string
  notes?: string
  doctorNotes?: string
  cancelReason?: string
  cancelledBy?: string
  fee?: number
  isPaid: boolean
  paidAt?: Date
  createdAt: Date
  updatedAt: Date
}

export class AppointmentEntity {
  private constructor(private props: AppointmentProps) {}

  static create(props: AppointmentProps): AppointmentEntity {
    if (!props.doctorId && !props.facilityId) {
      throw new BusinessRuleError('الموعد يجب أن يكون مرتبطاً بطبيب أو منشأة')
    }
    return new AppointmentEntity(props)
  }

  get id(): string                    { return this.props.id }
  get clientId(): string              { return this.props.clientId }
  get doctorId(): string | undefined  { return this.props.doctorId }
  get facilityId(): string | undefined { return this.props.facilityId }
  get type(): AppointmentType         { return this.props.type }
  get status(): AppointmentStatus     { return this.props.status }
  get scheduledAt(): Date             { return this.props.scheduledAt }
  get duration(): number              { return this.props.duration }
  get reason(): string | undefined    { return this.props.reason }
  get fee(): number | undefined       { return this.props.fee }
  get isPaid(): boolean               { return this.props.isPaid }
  get doctorNotes(): string | undefined { return this.props.doctorNotes }

  isPending(): boolean    { return this.props.status === AppointmentStatus.PENDING }
  isConfirmed(): boolean  { return this.props.status === AppointmentStatus.CONFIRMED }
  isCompleted(): boolean  { return this.props.status === AppointmentStatus.COMPLETED }
  isCancelled(): boolean  { return this.props.status === AppointmentStatus.CANCELLED }

  isInFuture(): boolean {
    return this.props.scheduledAt > new Date()
  }

  canBeReviewed(): boolean {
    return this.isCompleted()
  }

  canBeCancelled(): boolean {
    return (this.isPending() || this.isConfirmed()) && this.isInFuture()
  }

  confirm(): void {
    if (!this.isPending()) {
      throw new BusinessRuleError('يمكن تأكيد المواعيد المعلقة فقط')
    }
    this.props.status = AppointmentStatus.CONFIRMED
  }

  complete(doctorNotes?: string): void {
    if (!this.isConfirmed()) {
      throw new BusinessRuleError('يمكن إتمام المواعيد المؤكدة فقط')
    }
    this.props.status = AppointmentStatus.COMPLETED
    if (doctorNotes) this.props.doctorNotes = doctorNotes
  }

  cancel(cancelledBy: string, reason: string): void {
    if (!this.canBeCancelled()) {
      throw new BusinessRuleError('لا يمكن إلغاء هذا الموعد')
    }
    this.props.status = AppointmentStatus.CANCELLED
    this.props.cancelledBy = cancelledBy
    this.props.cancelReason = reason
  }
}
