// =============================================================================
// src/core/domain/entities/client.ts
// =============================================================================

export interface ClientProps {
  id: string
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
  createdAt: Date
  updatedAt: Date
}

export class ClientEntity {
  private constructor(private readonly props: ClientProps) {}

  static create(props: ClientProps): ClientEntity {
    return new ClientEntity(props)
  }

  get id(): string              { return this.props.id }
  get userId(): string          { return this.props.userId }
  get firstName(): string       { return this.props.firstName }
  get lastName(): string        { return this.props.lastName }
  get fullName(): string        { return `${this.props.firstName} ${this.props.lastName}` }
  get dateOfBirth(): Date | undefined { return this.props.dateOfBirth }
  get city(): string | undefined { return this.props.city }
  get country(): string         { return this.props.country }
  get bloodType(): string | undefined { return this.props.bloodType }
  get allergies(): string[]     { return this.props.allergies }
  get chronicDiseases(): string[] { return this.props.chronicDiseases }

  getAge(): number | undefined {
    if (!this.props.dateOfBirth) return undefined
    const today = new Date()
    const birth = this.props.dateOfBirth
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }
}
