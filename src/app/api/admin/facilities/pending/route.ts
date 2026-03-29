// =============================================================================
// src/app/api/admin/facilities/pending/route.ts
// GET /api/admin/facilities/pending
// =============================================================================

import { NextRequest } from 'next/server'
import { Role, ApprovalStatus } from '@prisma/client'
import { container } from '@/infrastructure'
import { requireAuth } from '@/infrastructure/auth/providers/email-auth.provider'
import { ok, fromAppError, serverError } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN] })
    if (!auth.success) return fromAppError(auth.error)

    const page  = Number(req.nextUrl.searchParams.get('page')  ?? 1)
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 20)

    const result = await container.facilityRepo.search({
      approvalStatus: ApprovalStatus.DOCUMENTS_REVIEW,
      page,
      limit,
    })

    return ok(
      result.facilities.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        licenseNumber: f.licenseNumber,
        licenseDocUrl: f.licenseDocUrl,
        city: f.city,
        country: f.country,
        approvalStatus: f.approvalStatus,
      })),
      { total: result.total, page, limit }
    )
  } catch (err) {
    console.error('[GET /api/admin/facilities/pending]', err)
    return serverError()
  }
}
