import { NextRequest } from 'next/server'
import { InstantConsultStatus, Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth({ roles: [Role.CLIENT] })
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params

    const profile = await prisma.clientProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { id: true },
    })
    if (!profile) return ok({ error: true, message: 'الملف الشخصي غير موجود' })

    const consult = await prisma.instantConsultRequest.findFirst({
      where: { id, clientId: profile.id },
      include: {
        review: { select: { id: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    })
    if (!consult) return ok({ error: true, message: 'الاستشارة غير موجودة' })

    const doctorName = consult.doctor
      ? `د. ${consult.doctor.firstName} ${consult.doctor.lastName}`
      : null

    return ok({
      id: consult.id,
      status: consult.status,
      doctorId: consult.doctorId,
      doctor: doctorName,
      hasReview: !!consult.review,
      canReview:
        consult.status === InstantConsultStatus.COMPLETED &&
        !!consult.doctorId &&
        !consult.review,
    })
  } catch (err) {
    console.error('[GET /api/instant-consult/[id]/rating]', err)
    return serverError()
  }
}
