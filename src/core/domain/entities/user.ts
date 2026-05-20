// =============================================================================
// src/core/domain/entities/user.ts
// =============================================================================

import { Role } from '@prisma/client'
import { Email } from '../value-objects/email'

export interface UserProps {
  id: string
  email?: Email
  role: Role
  isActive: boolean
  piUid?: string
  piUsername?: string
  createdAt: Date
  updatedAt: Date
}

export class UserEntity {
  private constructor(private readonly props: UserProps) {}

  static create(props: UserProps): UserEntity {
    return new UserEntity(props)
  }

  get id(): string           { return this.props.id }
  get email(): Email | undefined { return this.props.email }
  get role(): Role           { return this.props.role }
  get isActive(): boolean    { return this.props.isActive }
  get piUid(): string | undefined { return this.props.piUid }
  get piUsername(): string | undefined { return this.props.piUsername }
  get createdAt(): Date      { return this.props.createdAt }

  isAdmin(): boolean   { return this.props.role === Role.ADMIN }
  isDoctor(): boolean  { return this.props.role === Role.DOCTOR }
  isFacility(): boolean { return this.props.role === Role.FACILITY }
  isClient(): boolean  { return this.props.role === Role.CLIENT }
}
