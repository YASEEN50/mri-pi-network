// src/lib/premio/active-premio.ts
// Shared Premio visibility rules for public doctor listings

import { ApprovalStatus, PremioStatus, Prisma, Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/** Prisma filter: premio record is ACTIVE and not expired */
export function activePremioWhere(now = new Date()): Prisma.PremioWhereInput {
  return {
    status: PremioStatus.ACTIVE,
    OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
  }
}

/** Approved doctor profile (no Premio gate — e.g. instant consult) */
export function doctorProfileApprovedWhere(
  extra?: Prisma.DoctorProfileWhereInput
): Prisma.DoctorProfileWhereInput {
  return {
    approvalStatus: ApprovalStatus.APPROVED,
    deletedAt: null,
    ...extra,
  }
}

/** Public doctor listing: approved + active premio on linked user */
export function doctorProfilePublicWhere(
  extra?: Prisma.DoctorProfileWhereInput
): Prisma.DoctorProfileWhereInput {
  return {
    approvalStatus: ApprovalStatus.APPROVED,
    deletedAt: null,
    user: {
      premios: {
        some: activePremioWhere(),
      },
    },
    ...extra,
  }
}

export async function userHasActivePremio(userId: string): Promise<boolean> {
  const premio = await prisma.premio.findFirst({
    where: { userId, ...activePremioWhere() },
    select: { id: true },
  })
  return !!premio
}

export async function doctorHasActivePremioByProfileId(doctorId: string): Promise<boolean> {
  const doctor = await prisma.doctorProfile.findFirst({
    where: { id: doctorId, deletedAt: null },
    select: { userId: true },
  })
  if (!doctor) return false
  return userHasActivePremio(doctor.userId)
}

export function canBypassPremioGating(role?: string | null): boolean {
  return role === Role.ADMIN || role === Role.OWNER
}

/** Expire stale ACTIVE premios (best-effort, call before public listing) */
export async function expireStalePremios(userId?: string): Promise<void> {
  const now = new Date()
  await prisma.premio.updateMany({
    where: {
      status: PremioStatus.ACTIVE,
      expiryDate: { lte: now },
      ...(userId ? { userId } : {}),
    },
    data: { status: PremioStatus.EXPIRED },
  })
}
