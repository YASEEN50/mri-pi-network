import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, serverError, fromZodError } from '@/lib/api-response'
import { requireFacilityProfile } from '@/lib/facility/require-facility-profile'
import { normalizeWebsite } from '@/lib/facility/profile-utils'

const UpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional(),
  phone: z.string().max(30).optional(),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  website: z.string().max(200).optional(),
  address: z.string().min(5).max(300).optional(),
  city: z.string().min(2).max(100).optional(),
})

export async function GET() {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const facility = await prisma.facilityProfile.findUnique({
      where: { id: auth.facilityId },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        logoUrl: true,
        coverUrl: true,
        phone: true,
        email: true,
        website: true,
        address: true,
        city: true,
        country: true,
        approvalStatus: true,
        averageRating: true,
        totalReviews: true,
      },
    })

    if (!facility) return ok(null)

    return ok({
      ...facility,
      averageRating: Number(facility.averageRating),
    })
  } catch (err) {
    console.error('[GET /api/facility/profile]', err)
    return serverError()
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireFacilityProfile()
    if (!auth.success) return fromAppError(auth.error)

    const parsed = UpdateSchema.safeParse(await req.json())
    if (!parsed.success) return fromZodError(parsed.error)

    const data = parsed.data
    const website = data.website !== undefined ? normalizeWebsite(data.website) : undefined

    const updated = await prisma.facilityProfile.update({
      where: { id: auth.facilityId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(website !== undefined && { website }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        logoUrl: true,
        coverUrl: true,
        phone: true,
        email: true,
        website: true,
        address: true,
        city: true,
      },
    })

    return ok(updated)
  } catch (err) {
    console.error('[PATCH /api/facility/profile]', err)
    return serverError()
  }
}
