// src/app/api/admin/facilities/pending/route.ts
import { NextRequest } from 'next/server'
import { Role, ApprovalStatus } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { resolveStoredDocUrl } from '@/lib/storage/local-file-url'

const PENDING_WHERE = {
  approvalStatus: { in: [ApprovalStatus.PENDING, ApprovalStatus.DOCUMENTS_REVIEW] as ApprovalStatus[] },
  deletedAt: null,
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const page  = Number(req.nextUrl.searchParams.get('page')  ?? 1)
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 20)
    const skip  = (page - 1) * limit

    const [facilities, total] = await Promise.all([
      prisma.facilityProfile.findMany({
        where: PENDING_WHERE,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          type: true,
          licenseNumber: true,
          approvalStatus: true,
          city: true,
          phone: true,
          licenseDocUrl: true,
          ownershipDocUrl: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
      prisma.facilityProfile.count({ where: PENDING_WHERE }),
    ])

    return ok(
      facilities.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        licenseNumber: f.licenseNumber,
        approvalStatus: f.approvalStatus,
        city: f.city,
        phone: f.phone,
        email: f.user.email,
        createdAt: f.createdAt,
        hasOwnershipDoc: Boolean(resolveStoredDocUrl(f.ownershipDocUrl)),
        hasLicenseDoc: Boolean(resolveStoredDocUrl(f.licenseDocUrl)),
      })),
      { total, page, limit },
    )
  } catch (err) {
    console.error('[GET /api/admin/facilities/pending]', err)
    return serverError()
  }
}
