import { NextRequest } from 'next/server'
import { InstantConsultStatus, Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { notifyInstantConsultReviewRequested } from '@/lib/reviews/notifications'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params

    if (auth.context.role === Role.DOCTOR) {
      const doctor = await prisma.doctorProfile.findUnique({
        where: { userId: auth.context.userId },
        select: { id: true },
      })
      if (!doctor) return ok({ error: true, message: 'غير مصرح' })

      const request = await prisma.instantConsultRequest.findFirst({
        where: { id, doctorId: doctor.id, status: InstantConsultStatus.ACCEPTED },
      })
      if (!request) return ok({ error: true, message: 'الجلسة غير نشطة' })

      await prisma.instantConsultRequest.update({
        where: { id },
        data: { status: InstantConsultStatus.COMPLETED, completedAt: new Date() },
      })
      if (request.chatRoomId) {
        await prisma.chatRoom.update({
          where: { id: request.chatRoomId },
          data: { status: 'CLOSED' },
        })
      }
      notifyInstantConsultReviewRequested(id).catch(console.error)
      return ok({ completed: true })
    }

    if (auth.context.role === Role.CLIENT) {
      const profile = await prisma.clientProfile.findUnique({
        where: { userId: auth.context.userId },
        select: { id: true },
      })
      if (!profile) return ok({ error: true, message: 'غير مصرح' })

      const request = await prisma.instantConsultRequest.findFirst({
        where: {
          id,
          clientId: profile.id,
          status: { in: [InstantConsultStatus.AWAITING_PAYMENT, InstantConsultStatus.PENDING] },
        },
      })
      if (!request) return ok({ error: true, message: 'لا يمكن إلغاء هذا الطلب' })

      await prisma.instantConsultRequest.update({
        where: { id },
        data: { status: InstantConsultStatus.CANCELLED },
      })
      return ok({ cancelled: true })
    }

    return ok({ error: true, message: 'غير مصرح' })
  } catch (err) {
    console.error('[POST /api/instant-consult/[id]/complete]', err)
    return serverError()
  }
}
