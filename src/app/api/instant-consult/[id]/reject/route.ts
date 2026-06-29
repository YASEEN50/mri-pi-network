import { NextRequest } from 'next/server'
import { InstantConsultStatus, Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { refundInstantConsultPayment } from '@/lib/payment/instant-consult-escrow'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { id: true, specialization: true },
    })
    if (!doctor) return ok({ error: true, message: 'ملف الطبيب غير موجود' })

    const broadcastDismiss = await prisma.instantConsultRequest.findFirst({
      where: {
        id,
        status: InstantConsultStatus.PENDING,
        isBroadcast: true,
        doctorId: null,
        targetSpecialization: {
          contains: doctor.specialization,
          mode: 'insensitive',
        },
      },
    })
    if (broadcastDismiss) {
      return ok({
        rejected: true,
        dismissed: true,
        message: 'تم تجاهل طلب البث — الطلب ما زال متاحاً لأطباء آخرين',
      })
    }

    const request = await prisma.instantConsultRequest.findFirst({
      where: { id, doctorId: doctor.id, status: InstantConsultStatus.PENDING },
    })
    if (!request) return ok({ error: true, message: 'الطلب غير موجود' })

    await prisma.instantConsultRequest.update({
      where: { id },
      data: { status: InstantConsultStatus.REJECTED, rejectedAt: new Date() },
    })

    const refund = await refundInstantConsultPayment(id)

    const client = await prisma.clientProfile.findUnique({
      where: { id: request.clientId },
      select: { userId: true },
    })
    if (client) {
      await prisma.notification.create({
        data: {
          userId: client.userId,
          title: '❌ لم يقبل الطبيب',
          body: refund.refunded
            ? `لم يقبل الطبيب الاستشارة — أُرجِع ${refund.amount?.toFixed(4) ?? ''} π إلى رصيدك في المنصة`
            : 'لم يقبل الطبيب الاستشارة الفورية — جرّب طبيباً آخر',
          type: 'INSTANT_CONSULT_REJECTED',
          data: { requestId: id },
        },
      })
    }

    return ok({ rejected: true })
  } catch (err) {
    console.error('[POST /api/instant-consult/[id]/reject]', err)
    return serverError()
  }
}
