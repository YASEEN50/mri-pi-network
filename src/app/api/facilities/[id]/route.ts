import { NextRequest } from 'next/server'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { NotFoundError } from '@/core/errors'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const facility = await prisma.facilityProfile.findFirst({
      where: { id, deletedAt: null },
    })
    if (!facility) return fromAppError(new NotFoundError(`المنشأة بالمعرف ${id} غير موجودة`))

    return ok({
      id: facility.id, name: facility.name, type: facility.type,
      description: facility.description, address: facility.address,
      city: facility.city, country: facility.country,
      phone: facility.phone, email: facility.email, website: facility.website,
      logoUrl: facility.logoUrl, coverUrl: facility.coverUrl,
      averageRating: Number(facility.averageRating), totalReviews: facility.totalReviews,
    })
  } catch (err) {
    console.error('[GET /api/facilities/[id]]', err)
    return serverError()
  }
}
