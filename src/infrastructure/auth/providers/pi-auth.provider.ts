import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export interface PiProviderResult {
  id: string
  piUid: string
  piUsername: string
  role: Role
  isNewUser: boolean
  isProfileComplete: boolean
}

export class PiAuthProvider {
  async verify(piUid: string, piUsername: string): Promise<PiProviderResult> {
    let user = await prisma.user.findFirst({
      where: { piUid, deletedAt: null },
    })
    let isNewUser = false
    if (!user) {
      user = await prisma.user.create({
        data: { piUid, piUsername, role: Role.CLIENT, isActive: true },
      })
      isNewUser = true
    }
    return {
      id: user.id,
      piUid: user.piUid!,
      piUsername: user.piUsername!,
      role: user.role,
      isNewUser,
      isProfileComplete: user.role !== Role.CLIENT,
    }
  }
}
