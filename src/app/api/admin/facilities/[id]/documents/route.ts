// src/app/api/admin/facilities/[id]/documents/route.ts
import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { NotFoundError } from '@/core/errors'
import { prisma } from '@/lib/prisma'
import { resolveStoredDocUrl, inferMimeFromUrl } from '@/lib/storage/local-file-url'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewVerification)
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params

    const facility = await prisma.facilityProfile.findFirst({
      where: { id, deletedAt: null },
      include: { user: { select: { email: true, createdAt: true } } },
    })

    if (!facility) return fromAppError(new NotFoundError('المنشأة غير موجودة'))

    const ownershipUrl = resolveStoredDocUrl(facility.ownershipDocUrl)
    const licenseUrl   = resolveStoredDocUrl(facility.licenseDocUrl)

    return ok({
      facility: {
        id: facility.id,
        name: facility.name,
        type: facility.type,
        licenseNumber: facility.licenseNumber,
        city: facility.city,
        address: facility.address,
        phone: facility.phone,
        email: facility.email ?? facility.user.email,
        description: facility.description,
        approvalStatus: facility.approvalStatus,
        approvalNotes: facility.approvalNotes,
        createdAt: facility.createdAt,
      },
      documents: {
        ownership: ownershipUrl
          ? { url: ownershipUrl, mimeType: inferMimeFromUrl(ownershipUrl) }
          : null,
        license: licenseUrl
          ? { url: licenseUrl, mimeType: inferMimeFromUrl(licenseUrl) }
          : null,
      },
    })
  } catch (err) {
    console.error('[GET /api/admin/facilities/[id]/documents]', err)
    return serverError()
  }
}
