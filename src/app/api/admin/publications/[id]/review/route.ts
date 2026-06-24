import { NextRequest } from 'next/server'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role, PublicationStatus } from '@prisma/client'
import { z } from 'zod'
import {
  notifyDoctorPublicationApproved,
  notifyDoctorPublicationRejected,
} from '@/lib/notifications/service'

const ReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes:  z.string().max(1000).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canModerateContent)
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const body   = await req.json()
    const parsed = ReviewSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const pub = await prisma.publication.findFirst({
      where: { id, deletedAt: null },
      include: {
        doctor: { select: { userId: true } },
      },
    })
    if (!pub) return ok({ error: true, message: 'المنشور غير موجود' })
    if (pub.status !== PublicationStatus.PENDING_REVIEW) {
      return ok({ error: true, message: 'المنشور ليس بانتظار المراجعة' })
    }

    const isApprove = parsed.data.action === 'approve'

    const updated = await prisma.publication.update({
      where: { id },
      data: {
        status:      isApprove ? PublicationStatus.PUBLISHED : PublicationStatus.REJECTED,
        publishedAt: isApprove ? new Date() : null,
        updatedAt:   new Date(),
      },
    })

    if (pub.doctor?.userId) {
      if (isApprove) {
        await notifyDoctorPublicationApproved(pub.doctor.userId, id, pub.title)
      } else {
        await notifyDoctorPublicationRejected(
          pub.doctor.userId, id, pub.title, parsed.data.notes,
        )
      }
    }

    return ok({
      message: isApprove ? 'تمت الموافقة ونشر المنشور' : 'تم رفض المنشور',
      status:  updated.status,
    })
  } catch (err) {
    console.error('[POST /api/admin/publications/[id]/review]', err)
    return serverError()
  }
}
