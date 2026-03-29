// =============================================================================
// src/app/api/admin/doctors/pending/route.ts
// GET /api/admin/doctors/pending
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

    const result = await container.doctorRepo.search({
      approvalStatus: ApprovalStatus.DOCUMENTS_REVIEW,
      page,
      limit,
    })

    return ok(
      result.doctors.map((d) => ({
        id: d.id,
        fullName: d.fullName,
        specialization: d.specialization,
        licenseNumber: d.licenseNumber.value,
        credentialsCount: d.credentials.length,
        approvalStatus: d.approvalStatus,
        city: d.city,
        country: d.country,
      })),
      { total: result.total, page, limit }
    )
  } catch (err) {
    console.error('[GET /api/admin/doctors/pending]', err)
    return serverError()
  }
}
