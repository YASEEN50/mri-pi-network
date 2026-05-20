// src/app/api/facilities/route.ts
// GET /api/facilities — بحث وفلترة
import { NextRequest } from 'next/server'
import { ApprovalStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page   = Number(searchParams.get('page')  ?? 1)
    const limit  = Number(searchParams.get('limit') ?? 20)
    const skip   = (page - 1) * limit
    const search = searchParams.get('search') ?? ''
    const type   = searchParams.get('type') ?? ''
    const city   = searchParams.get('city') ?? ''

    const where: any = {
      approvalStatus: ApprovalStatus.APPROVED,
      deletedAt: null,
      ...(search && {
        OR: [
          { name:        { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(type && { type }),
      ...(city && { city: { contains: city, mode: 'insensitive' } }),
    }

    const [facilities, total] = await Promise.all([
      prisma.facilityProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }],
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          city: true,
          country: true,
          phone: true,
          email: true,
          website: true,
          averageRating: true,
          totalReviews: true,
          logoUrl: true,
        },
      }),
      prisma.facilityProfile.count({ where }),
    ])

    return ok(
      facilities.map((f: any) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        description: f.description,
        city: f.city,
        country: f.country,
        phone: f.phone,
        email: f.email,
        website: f.website,
        averageRating: Number(f.averageRating),
        totalReviews: f.totalReviews,
        logoUrl: f.logoUrl,
      })),
      { total, page, limit }
    )
  } catch (err) {
    console.error('[GET /api/facilities]', err)
    return serverError()
  }
}
