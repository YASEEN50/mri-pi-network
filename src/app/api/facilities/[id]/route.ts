// =============================================================================
// src/app/api/facilities/[id]/route.ts
// =============================================================================

import { NextRequest } from 'next/server'
import { container } from '@/infrastructure'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { NotFoundError } from '@/core/errors'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const facility = await container.facilityRepo.findById(params.id)
    if (!facility) return fromAppError(new NotFoundError('المنشأة', params.id))

    return ok({
      id: facility.id,
      name: facility.name,
      type: facility.type,
      description: facility.description,
      address: facility.address,
      city: facility.city,
      country: facility.country,
      phone: facility.phone,
      email: facility.email,
      website: facility.website,
      averageRating: facility.averageRating,
      totalReviews: facility.totalReviews,
    })
  } catch (err) {
    console.error('[GET /api/facilities/[id]]', err)
    return serverError()
  }
}
