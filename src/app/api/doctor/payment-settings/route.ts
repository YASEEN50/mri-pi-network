// src/app/api/doctor/payment-settings/route.ts
import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const Schema = z.object({
  paymentPolicy: z.enum(['PAY_BEFORE_BOOKING', 'DEPOSIT_AND_PAY_LATER', 'PAY_ON_SERVICE']).optional(),
  depositPercentage: z.number().min(0).max(99).optional(),
  paymentDeadlineHours: z.number().min(1).max(168).optional(),
  consultationFee: z.number().positive().max(1_000_000).optional(),
})

export async function GET() {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)
    const profile = await prisma.doctorProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { paymentPolicy: true, depositPercentage: true, paymentDeadlineHours: true, consultationFee: true },
    })
    if (!profile) return ok(null)
    return ok({
      paymentPolicy: profile.paymentPolicy,
      depositPercentage: Number(profile.depositPercentage),
      paymentDeadlineHours: profile.paymentDeadlineHours,
      consultationFee: profile.consultationFee ? Number(profile.consultationFee) : null,
    })
  } catch (err) {
    console.error('[GET /api/doctor/payment-settings]', err)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { paymentPolicy, depositPercentage, paymentDeadlineHours, consultationFee } = parsed.data

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { id: true, paymentPolicy: true },
    })
    if (!doctor) return ok({ error: true, message: 'ملف الطبيب غير موجود' })

    if (paymentPolicy && paymentPolicy !== doctor.paymentPolicy) {
      const pendingCount = await prisma.appointment.count({
        where: { doctorId: doctor.id, status: { in: ['PENDING', 'CONFIRMED'] }, deletedAt: null },
      })
      if (pendingCount > 0) {
        return ok({ error: true, message: `لا يمكن تغيير سياسة الدفع - لديك ${pendingCount} موعد قيد الانتظار` })
      }
    }

    const deposit =
      (paymentPolicy ?? doctor.paymentPolicy) === 'DEPOSIT_AND_PAY_LATER'
        ? (depositPercentage ?? 30)
        : paymentPolicy
          ? 0
          : undefined

    await prisma.doctorProfile.update({
      where: { userId: auth.context.userId },
      data: {
        ...(paymentPolicy && { paymentPolicy }),
        ...(deposit !== undefined && { depositPercentage: deposit }),
        ...(paymentDeadlineHours !== undefined && { paymentDeadlineHours }),
        ...(consultationFee !== undefined && { consultationFee }),
      },
    })
    return ok({ message: 'تم تحديث إعدادات الدفع بنجاح' })
  } catch (err) {
    console.error('[POST /api/doctor/payment-settings]', err)
    return serverError()
  }
}
