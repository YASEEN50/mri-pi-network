import { BusinessRuleError } from '@/core/errors'

export interface ReviewProps {
  id: string
  clientId: string
  doctorId?: string
  facilityId?: string
  appointmentId?: string
  rating: number
  comment?: string
  isVisible: boolean
  createdAt: Date
  updatedAt: Date
}

export class ReviewEntity {
  private constructor(private props: ReviewProps) {}

  static create(props: ReviewProps): ReviewEntity {
    if (props.rating < 1 || props.rating > 5) {
      throw new BusinessRuleError('التقييم يجب أن يكون بين 1 و 5')
    }
    if (!props.doctorId && !props.facilityId) {
      throw new BusinessRuleError('التقييم يجب أن يكون مرتبطاً بطبيب أو منشأة')
    }
    return new ReviewEntity(props)
  }

  get id(): string                        { return this.props.id }
  get clientId(): string                  { return this.props.clientId }
  get doctorId(): string | undefined      { return this.props.doctorId }
  get facilityId(): string | undefined    { return this.props.facilityId }
  get appointmentId(): string | undefined { return this.props.appointmentId }
  get rating(): number                    { return this.props.rating }
  get comment(): string | undefined       { return this.props.comment }
  get isVisible(): boolean                { return this.props.isVisible }
  get createdAt(): Date                   { return this.props.createdAt }

  hide(): void { this.props.isVisible = false }
  show(): void { this.props.isVisible = true }
}
