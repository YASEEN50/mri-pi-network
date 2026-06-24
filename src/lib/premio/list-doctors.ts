import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { activePremioWhere, doctorProfilePublicWhere, expireStalePremios } from '@/lib/premio/active-premio'
import { pickHighestTier, premioTypeToTier, PremioTier, sortByPremioTier } from '@/lib/premio/tiers'

type DoctorWithStats = {
  userId: string
  averageRating: number | Prisma.Decimal
  totalReviews: number
}

export async function getPremioTiersByUserIds(userIds: string[]): Promise<Map<string, PremioTier>> {
  if (userIds.length === 0) return new Map()

  const premios = await prisma.premio.findMany({
    where: { userId: { in: userIds }, ...activePremioWhere() },
    select: { userId: true, type: true },
  })

  const byUser = new Map<string, PremioTier>()
  for (const userId of userIds) {
    const types = premios.filter(p => p.userId === userId).map(p => p.type)
    byUser.set(userId, types.length > 0 ? pickHighestTier(types) : 'BASIC')
  }
  return byUser
}

export async function getDoctorPremioTierByProfileId(doctorId: string): Promise<PremioTier | null> {
  const doctor = await prisma.doctorProfile.findFirst({
    where: { id: doctorId, deletedAt: null },
    select: { userId: true },
  })
  if (!doctor) return null
  const map = await getPremioTiersByUserIds([doctor.userId])
  return map.get(doctor.userId) ?? null
}

export async function attachPremioTiers<T extends DoctorWithStats>(
  doctors: T[],
): Promise<Array<T & { premioTier: PremioTier }>> {
  const tierMap = await getPremioTiersByUserIds(doctors.map(d => d.userId))
  return doctors.map(d => ({
    ...d,
    premioTier: tierMap.get(d.userId) ?? 'BASIC',
  }))
}

export async function listPublicDoctors(options: {
  where?: Prisma.DoctorProfileWhereInput
  skip?: number
  take?: number
}) {
  await expireStalePremios()
  const doctors = await prisma.doctorProfile.findMany({
    where: doctorProfilePublicWhere(options.where),
    skip: options.skip,
    take: options.take,
  })

  const withTiers = await attachPremioTiers(doctors)
  return sortByPremioTier(withTiers)
}

export async function getActivePremioForUser(userId: string) {
  const premio = await prisma.premio.findFirst({
    where: { userId, ...activePremioWhere() },
    orderBy: { createdAt: 'desc' },
  })
  if (!premio) return null
  return {
    id: premio.id,
    type: premio.type,
    status: premio.status,
    startDate: premio.startDate,
    expiryDate: premio.expiryDate,
    tier: premioTypeToTier(premio.type),
  }
}
