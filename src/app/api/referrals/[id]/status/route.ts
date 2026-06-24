import { NextRequest } from 'next/server'
import { Role, ReferralStatus } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { canTransition, serializeReferral } from '@/lib/referrals/serialize'
import { awardReferralReward } from '@/lib/referrals/award-reward'
import {
  notifyReferralAccepted,
  notifyReferralCancelled,
} from '@/lib/referrals/notifications'

const UpdateSchema = z.object({
  status: z.enum(['ACCEPTED', 'COMPLETED', 'CANCELLED']),
  resultNotes: z.string().max(1000).optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { id: true },
    })
    if (!doctor) return ok({ error: true, message: 'ملف الطبيب غير موجود' })

    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { status, resultNotes } = parsed.data
    const referral = await prisma.referral.findUnique({
      where: { id },
      include: {
        fromDoctor: { select: { id: true, firstName: true, lastName: true, specialization: true, userId: true } },
        toDoctor: { select: { id: true, firstName: true, lastName: true, specialization: true, userId: true } },
      },
    })
    if (!referral) return ok({ error: true, message: 'الإحالة غير موجودة' })

    const isSender = referral.fromDoctorId === doctor.id
    const isReceiver = referral.toDoctorId === doctor.id
    if (!isSender && !isReceiver) {
      return ok({ error: true, message: 'غير مصرح بتعديل هذه الإحالة' })
    }

    const nextStatus = status as ReferralStatus
    if (!canTransition(referral.status, nextStatus)) {
      return ok({ error: true, message: 'انتقال حالة غير مسموح' })
    }

    if (nextStatus === ReferralStatus.ACCEPTED && !isReceiver) {
      return ok({ error: true, message: 'فقط الطبيب المستلم يمكنه قبول الإحالة' })
    }
    if (nextStatus === ReferralStatus.COMPLETED && !isReceiver) {
      return ok({ error: true, message: 'فقط الطبيب المستلم يمكنه إتمام الإحالة' })
    }
    if (nextStatus === ReferralStatus.CANCELLED && referral.status === ReferralStatus.COMPLETED) {
      return ok({ error: true, message: 'لا يمكن إلغاء إحالة مكتملة' })
    }

    const updated = await prisma.referral.update({
      where: { id },
      data: {
        status: nextStatus,
        ...(resultNotes !== undefined && { resultNotes }),
      },
      include: {
        fromDoctor: { select: { id: true, firstName: true, lastName: true, specialization: true, userId: true } },
        toDoctor: { select: { id: true, firstName: true, lastName: true, specialization: true, userId: true } },
      },
    })

    if (nextStatus === ReferralStatus.ACCEPTED) {
      notifyReferralAccepted(id).catch(console.error)
    }
    if (nextStatus === ReferralStatus.CANCELLED) {
      notifyReferralCancelled(id, auth.context.userId).catch(console.error)
    }
    if (nextStatus === ReferralStatus.COMPLETED) {
      awardReferralReward(id).catch(console.error)
    }

    return ok(await serializeReferral(updated))
  } catch (err) {
    console.error('[PUT /api/referrals/[id]/status]', err)
    return serverError()
  }
}
