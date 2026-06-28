import { NextRequest } from 'next/server'
import { PaidAdPlacement, PaidAdStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const placement = (req.nextUrl.searchParams.get('placement') ?? 'HOME_SIDEBAR') as PaidAdPlacement
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 4)
    const now = new Date()

    const ads = await prisma.paidAdvertisement.findMany({
      where: {
        placement,
        status: PaidAdStatus.ACTIVE,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        linkUrl: true,
        advertiserName: true,
      },
    })

    return ok(ads)
  } catch (err) {
    console.error('[GET /api/ads/active]', err)
    return serverError()
  }
}
