import { prisma } from '@/lib/prisma'
import { PaidAdPlacement, PaidAdStatus } from '@prisma/client'

export async function getActiveHomeSidebarAds(limit = 4) {
  const now = new Date()
  return prisma.paidAdvertisement.findMany({
    where: {
      placement: PaidAdPlacement.HOME_SIDEBAR,
      status: PaidAdStatus.ACTIVE,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  })
}

export type HomeSidebarAd = Awaited<ReturnType<typeof getActiveHomeSidebarAds>>[number]
