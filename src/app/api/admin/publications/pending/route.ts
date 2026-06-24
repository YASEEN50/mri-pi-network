import { NextRequest } from 'next/server'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role, PublicationStatus } from '@prisma/client'

export async function GET(_req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canModerateContent)
    if (!auth.success) return fromAppError(auth.error)

    const publications = await prisma.publication.findMany({
      where: {
        status:    PublicationStatus.PENDING_REVIEW,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        doctor: {
          select: {
            id: true, firstName: true, lastName: true,
            specialization: true, user: { select: { email: true } },
          },
        },
      },
    })

    return ok(
      publications.map(p => ({
        id:        p.id,
        title:     p.title,
        summary:   p.summary,
        content:   p.content,
        type:      p.type,
        tags:      p.tags,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        doctor: p.doctor ? {
          id:             p.doctor.id,
          name:           `د. ${p.doctor.firstName} ${p.doctor.lastName}`,
          specialization: p.doctor.specialization,
          email:          p.doctor.user?.email ?? null,
        } : null,
      })),
    )
  } catch (err) {
    console.error('[GET /api/admin/publications/pending]', err)
    return serverError()
  }
}
