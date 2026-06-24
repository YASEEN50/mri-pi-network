import { prisma } from '@/lib/prisma'
import { ReferralStatus } from '@prisma/client'

type ReferralWithRelations = Awaited<ReturnType<typeof fetchReferralById>>

async function fetchReferralById(id: string) {
  return prisma.referral.findUnique({
    where: { id },
    include: {
      fromDoctor: { select: { id: true, firstName: true, lastName: true, specialization: true, userId: true } },
      toDoctor: { select: { id: true, firstName: true, lastName: true, specialization: true, userId: true } },
    },
  })
}

async function clientLabel(clientId: string): Promise<string> {
  const profile = await prisma.clientProfile.findUnique({
    where: { userId: clientId },
    select: { firstName: true, lastName: true },
  })
  if (profile) return `${profile.firstName} ${profile.lastName}`
  const user = await prisma.user.findUnique({
    where: { id: clientId },
    select: { email: true, piUsername: true },
  })
  return user?.piUsername ?? user?.email ?? 'مريض'
}

export async function serializeReferral(ref: NonNullable<ReferralWithRelations>) {
  const clientName = await clientLabel(ref.clientId)
  return {
    id: ref.id,
    status: ref.status,
    reason: ref.reason,
    notes: ref.notes,
    resultNotes: ref.resultNotes,
    appointmentId: ref.appointmentId,
    clientId: ref.clientId,
    clientName,
    fromDoctor: {
      id: ref.fromDoctor.id,
      name: `د. ${ref.fromDoctor.firstName} ${ref.fromDoctor.lastName}`,
      specialization: ref.fromDoctor.specialization,
    },
    toDoctor: {
      id: ref.toDoctor.id,
      name: `د. ${ref.toDoctor.firstName} ${ref.toDoctor.lastName}`,
      specialization: ref.toDoctor.specialization,
    },
    createdAt: ref.createdAt,
    updatedAt: ref.updatedAt,
  }
}

export async function serializeReferrals(refs: NonNullable<ReferralWithRelations>[]) {
  return Promise.all(refs.map(serializeReferral))
}

export function canTransition(from: ReferralStatus, to: ReferralStatus): boolean {
  const allowed: Record<ReferralStatus, ReferralStatus[]> = {
    PENDING: ['ACCEPTED', 'CANCELLED'],
    ACCEPTED: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  }
  return allowed[from]?.includes(to) ?? false
}
