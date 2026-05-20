// =============================================================================
// src/core/interfaces/repositories/user.repository.interface.ts
// =============================================================================

import { UserEntity } from '@/core/domain/entities/user'
import { Role } from '@prisma/client'

export interface IUserRepository {
  findById(id: string): Promise<UserEntity | null>
  findByEmail(email: string): Promise<UserEntity | null>
  findByPiUid(piUid: string): Promise<UserEntity | null>
  existsByEmail(email: string): Promise<boolean>
  updateRole(userId: string, role: Role): Promise<void>
  softDelete(userId: string): Promise<void>
}
