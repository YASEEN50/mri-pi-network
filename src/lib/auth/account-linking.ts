import { prisma } from '@/lib/prisma'
import type { User } from '@prisma/client'

export interface VerifiedPiUser {
  uid: string
  username: string
}

/** Find or create user on Pi login (no auto-link by email). */
export async function resolvePiLoginUser(piUser: VerifiedPiUser): Promise<User> {
  const existing = await prisma.user.findFirst({
    where: { piUid: piUser.uid, deletedAt: null },
  })

  if (existing) {
    if (existing.piUsername !== piUser.username) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { piUsername: piUser.username, updatedAt: new Date() },
      })
    }
    return existing
  }

  return prisma.user.create({
    data: {
      piUid: piUser.uid,
      piUsername: piUser.username,
      role: 'CLIENT',
      isActive: true,
    },
  })
}

/** Attach Pi identity to an existing account; merge orphan Pi-only account if needed. */
export async function linkPiToUser(
  targetUserId: string,
  piUser: VerifiedPiUser,
): Promise<User> {
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, deletedAt: null },
  })
  if (!target) throw new Error('USER_NOT_FOUND')
  if (target.piUid) {
    if (target.piUid === piUser.uid) {
      return target.piUsername === piUser.username
        ? target
        : prisma.user.update({
            where: { id: target.id },
            data: { piUsername: piUser.username },
          })
    }
    throw new Error('PI_ALREADY_LINKED')
  }

  const piOwner = await prisma.user.findFirst({
    where: { piUid: piUser.uid, deletedAt: null },
  })

  if (piOwner && piOwner.id === targetUserId) {
    return piOwner
  }

  if (piOwner?.email) {
    throw new Error('PI_USED_BY_OTHER')
  }

  if (piOwner && !piOwner.email) {
    await mergePiOnlyAccountInto(targetUserId, piOwner.id)
  }

  const conflictUsername = await prisma.user.findFirst({
    where: {
      piUsername: piUser.username,
      deletedAt: null,
      id: { not: targetUserId },
    },
  })
  if (conflictUsername) {
    await prisma.user.update({
      where: { id: conflictUsername.id },
      data: { piUsername: null },
    })
  }

  return prisma.user.update({
    where: { id: targetUserId },
    data: {
      piUid: piUser.uid,
      piUsername: piUser.username,
      updatedAt: new Date(),
    },
  })
}

async function mergePiOnlyAccountInto(keepUserId: string, mergeUserId: string): Promise<void> {
  if (keepUserId === mergeUserId) return

  const [keep, merge] = await Promise.all([
    prisma.user.findUnique({
      where: { id: keepUserId },
      include: {
        clientProfile: true,
        doctorProfile: true,
        facilityProfile: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: mergeUserId },
      include: {
        clientProfile: true,
        doctorProfile: true,
        facilityProfile: true,
      },
    }),
  ])

  if (!keep || !merge || merge.email) return

  await prisma.$transaction(async (tx) => {
    if (merge.clientProfile && !keep.clientProfile) {
      await tx.clientProfile.update({
        where: { id: merge.clientProfile.id },
        data: { userId: keepUserId },
      })
    }
    if (merge.doctorProfile && !keep.doctorProfile) {
      await tx.doctorProfile.update({
        where: { id: merge.doctorProfile.id },
        data: { userId: keepUserId },
      })
    }
    if (merge.facilityProfile && !keep.facilityProfile) {
      await tx.facilityProfile.update({
        where: { id: merge.facilityProfile.id },
        data: { userId: keepUserId },
      })
    }

    await tx.appointment.updateMany({
      where: { clientId: mergeUserId },
      data: { clientId: keepUserId },
    })
    await tx.notification.updateMany({
      where: { userId: mergeUserId },
      data: { userId: keepUserId },
    })
    await tx.premio.updateMany({
      where: { userId: mergeUserId },
      data: { userId: keepUserId },
    })
    await tx.transaction.updateMany({
      where: { userId: mergeUserId },
      data: { userId: keepUserId },
    })
    await tx.review.updateMany({
      where: { clientId: mergeUserId },
      data: { clientId: keepUserId },
    })

    await tx.user.update({
      where: { id: mergeUserId },
      data: {
        piUid: null,
        piUsername: null,
        deletedAt: new Date(),
        isActive: false,
      },
    })
  })
}

export async function linkEmailToUser(
  userId: string,
  email: string,
  passwordHash: string,
): Promise<User> {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
  if (!user) throw new Error('USER_NOT_FOUND')
  if (user.email) throw new Error('EMAIL_ALREADY_SET')

  const taken = await prisma.user.findFirst({
    where: { email, deletedAt: null, id: { not: userId } },
  })
  if (taken) throw new Error('EMAIL_TAKEN')

  return prisma.user.update({
    where: { id: userId },
    data: {
      email,
      passwordHash,
      emailVerified: null,
      updatedAt: new Date(),
    },
  })
}
