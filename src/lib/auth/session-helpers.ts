import { prisma } from '@/lib/prisma'
import { Role, ApprovalStatus } from '@prisma/client'

export async function getProfileCompleteness(userId: string, role: Role): Promise<boolean> {
  switch (role) {
    case Role.CLIENT:
      return !!(await prisma.clientProfile.findUnique({ where: { userId } }))
    case Role.DOCTOR:
      return !!(await prisma.doctorProfile.findUnique({ where: { userId } }))
    case Role.FACILITY:
      return !!(await prisma.facilityProfile.findUnique({ where: { userId } }))
    case Role.ADMIN:
    case Role.OWNER:
      return true
    default:
      return true
  }
}

export async function getApprovalStatus(userId: string, role: Role): Promise<ApprovalStatus | null> {
  if (role === Role.DOCTOR) {
    const profile = await prisma.doctorProfile.findUnique({
      where: { userId },
      select: { approvalStatus: true },
    })
    return profile?.approvalStatus ?? null
  }
  if (role === Role.FACILITY) {
    const profile = await prisma.facilityProfile.findUnique({
      where: { userId },
      select: { approvalStatus: true },
    })
    return profile?.approvalStatus ?? null
  }
  return null
}
