// =============================================================================
// src/infrastructure/database/prisma/repositories/user.repository.ts
// IUserRepository — Prisma implementation
// =============================================================================

import { Role } from '@prisma/client'
import { prisma } from '../client'
import { IUserRepository } from '@/core/interfaces/repositories/user.repository.interface'
import { UserEntity } from '@/core/domain/entities/user'
import { Email } from '@/core/domain/value-objects/email'

export class PrismaUserRepository implements IUserRepository {
  // -------------------------------------------------------------------------
  private map(raw: {
    id: string
    email: string | null
    role: Role
    isActive: boolean
    piUid: string | null
    piUsername: string | null
    createdAt: Date
    updatedAt: Date
  }): UserEntity {
    return UserEntity.create({
      id: raw.id,
      email: raw.email ? Email.create(raw.email) : undefined,
      role: raw.role,
      isActive: raw.isActive,
      piUid: raw.piUid ?? undefined,
      piUsername: raw.piUsername ?? undefined,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    })
  }

  // -------------------------------------------------------------------------
  async findById(id: string): Promise<UserEntity | null> {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
    })
    return user ? this.map(user) : null
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    })
    return user ? this.map(user) : null
  }

  async findByPiUid(piUid: string): Promise<UserEntity | null> {
    const user = await prisma.user.findFirst({
      where: { piUid, deletedAt: null },
    })
    return user ? this.map(user) : null
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { email: email.toLowerCase(), deletedAt: null },
    })
    return count > 0
  }

  async updateRole(userId: string, role: Role): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { role, updatedAt: new Date() },
    })
  }

  async softDelete(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), isActive: false },
    })
  }
}
