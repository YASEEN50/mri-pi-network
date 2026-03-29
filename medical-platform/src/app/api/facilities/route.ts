// =============================================================================
// src/app/api/facilities/route.ts
// GET /api/facilities
// POST /api/facilities
// =============================================================================

import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { container } from '@/infrastructure'
import { requireAuth } from '@/infrastructure/auth/providers/email-auth.provider'
import { ok, created, fromAppError, parseQuery, serverError } from '@/lib/api-response'
import { RegisterFacilitySchema, FacilitySearchSchema } from '@/lib/validations/doctor.schema'
import { AppError } from '@/core/errors'

export async function GET(req: NextRequest) {
  try {
    const parsed = parseQuery(FacilitySearchSchema, req.nextUrl.searchParams)
    if (!parsed.success) return parsed.response

    const { page, limit, ...filters } = parsed.data
    const result = await container.facilityRepo.search({ ...filters, page, limit })

    return ok(
      result.facilities.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        city: f.city,
        country: f.country,
        address: f.address,
        averageRating: f.averageRating,
        totalReviews: f.totalReviews,
        phone: f.phone,
        website: f.website,
      })),
      { total: result.total, page, limit }
    )
  } catch (err) {
    console.error('[GET /api/facilities]', err)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.FACILITY] })
    if (!auth.success) return fromAppError(auth.error)

    const formData = await req.formData()
    const jsonStr = formData.get('data') as string
    if (!jsonStr) return fromAppError({ code: 'MISSING_DATA', message: 'بيانات JSON مطلوبة', statusCode: 400 } as any)

    const parsed = RegisterFacilitySchema.safeParse(JSON.parse(jsonStr))
    if (!parsed.success) {
      const { fromZodError } = await import('@/lib/api-response')
      return fromZodError(parsed.error)
    }

    const licenseFile = formData.get('licenseFile') as File | null
    if (!licenseFile) return fromAppError({ code: 'MISSING_LICENSE', message: 'وثيقة الترخيص مطلوبة', statusCode: 400 } as any)

    const result = await container.registerFacility.execute({
      userId: auth.context.userId,
      ...parsed.data,
      licenseFile: Buffer.from(await licenseFile.arrayBuffer()),
      licenseFileMime: licenseFile.type as 'image/jpeg' | 'image/png' | 'application/pdf',
      licenseExpiryDate: parsed.data.licenseExpiryDate ? new Date(parsed.data.licenseExpiryDate) : undefined,
    })

    if (!result.success) return fromAppError(result.error)

    return created({
      id: result.data.id,
      name: result.data.name,
      type: result.data.type,
      approvalStatus: result.data.approvalStatus,
      message: 'تم تقديم طلب تسجيل المنشأة بنجاح، سيتم مراجعة مستنداتك قريباً',
    })
  } catch (err) {
    console.error('[POST /api/facilities]', err)
    if (err instanceof AppError) return fromAppError(err)
    return serverError()
  }
}

// =============================================================================
// src/app/api/facilities/[id]/route.ts
// GET /api/facilities/[id]
// =============================================================================

import { NotFoundError } from '@/core/errors'

export async function GET_BY_ID(
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
      approvalStatus: facility.approvalStatus,
    })
  } catch (err) {
    console.error('[GET /api/facilities/[id]]', err)
    return serverError()
  }
}
