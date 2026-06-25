import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Role, InstantConsultStatus } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, created, fromAppError, serverError, fromZodError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import {
  doctorHasActiveInstantSession,
  expireStaleInstantConsults,
} from '@/lib/instant-consult/service'
import { doctorHasActivePremioByProfileId } from '@/lib/premio/active-premio'

const CreateSchema = z.object({
  doctorId: z.string().uuid(),
  reason: z.string().min(3).max(500).optional(),
})

export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    await expireStaleInstantConsults()

    const { userId, role } = auth.context

    if (role === Role.CLIENT) {
      const profile = await prisma.clientProfile.findUnique({
        where: { userId },
        select: { id: true },
      })
      if (!profile) return ok([])

      const requests = await prisma.instantConsultRequest.findMany({
        where: { clientId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          doctor: {
            select: { firstName: true, lastName: true, specialization: true, avatarUrl: true },
          },
        },
      })

      return ok(
        requests.map((r) => ({
          id: r.id,
          status: r.status,
          reason: r.reason,
          fee: Number(r.fee),
          isPaid: r.isPaid,
          expiresAt: r.expiresAt?.toISOString() ?? null,
          sessionEndsAt: r.sessionEndsAt?.toISOString() ?? null,
          chatRoomId: r.chatRoomId,
          doctor: {
            fullName: `د. ${r.doctor.firstName} ${r.doctor.lastName}`,
            specialization: r.doctor.specialization,
            avatarUrl: r.doctor.avatarUrl,
          },
          createdAt: r.createdAt.toISOString(),
        })),
      )
    }

    if (role === Role.DOCTOR) {
      const doctor = await prisma.doctorProfile.findUnique({
        where: { userId },
        select: { id: true },
      })
      if (!doctor) return ok([])

      const requests = await prisma.instantConsultRequest.findMany({
        where: {
          doctorId: doctor.id,
          status: { in: [InstantConsultStatus.PENDING, InstantConsultStatus.ACCEPTED] },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          client: { select: { firstName: true, lastName: true } },
        },
      })

      return ok(
        requests.map((r) => ({
          id: r.id,
          status: r.status,
          reason: r.reason,
          fee: Number(r.fee),
          expiresAt: r.expiresAt?.toISOString() ?? null,
          sessionEndsAt: r.sessionEndsAt?.toISOString() ?? null,
          chatRoomId: r.chatRoomId,
          client: { name: `${r.client.firstName} ${r.client.lastName}` },
          createdAt: r.createdAt.toISOString(),
        })),
      )
    }

    return ok([])
  } catch (err) {
    console.error('[GET /api/instant-consult]', err)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.CLIENT] })
    if (!auth.success) return fromAppError(auth.error)

    const parsed = CreateSchema.safeParse(await req.json())
    if (!parsed.success) return fromZodError(parsed.error)

    const profile = await prisma.clientProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { id: true },
    })
    if (!profile) return ok({ error: true, message: 'أكمل ملفك الشخصي أولاً' })

    const doctor = await prisma.doctorProfile.findFirst({
      where: {
        id: parsed.data.doctorId,
        deletedAt: null,
        approvalStatus: 'APPROVED',
        acceptsInstantConsult: true,
        isOnlineForInstant: true,
        instantConsultFee: { not: null, gt: 0 },
      },
      select: { id: true, instantConsultFee: true, firstName: true, lastName: true },
    })
    if (!doctor) return ok({ error: true, message: 'الطبيب غير متاح للاستشارة الفورية' })

    const listed = await doctorHasActivePremioByProfileId(doctor.id)
    if (!listed) return ok({ error: true, message: 'الطبيب غير متاح حالياً' })

    if (await doctorHasActiveInstantSession(doctor.id)) {
      return ok({ error: true, message: 'الطبيب مشغول في استشارة أخرى — جرّب طبيباً آخر' })
    }

    const existingPending = await prisma.instantConsultRequest.findFirst({
      where: {
        clientId: profile.id,
        doctorId: doctor.id,
        status: { in: [InstantConsultStatus.AWAITING_PAYMENT, InstantConsultStatus.PENDING, InstantConsultStatus.ACCEPTED] },
      },
    })
    if (existingPending) {
      return ok({ error: true, message: 'لديك طلب نشط مع هذا الطبيب', requestId: existingPending.id })
    }

    const fee = Number(doctor.instantConsultFee)
    const request = await prisma.instantConsultRequest.create({
      data: {
        clientId: profile.id,
        doctorId: doctor.id,
        reason: parsed.data.reason,
        fee,
        status: InstantConsultStatus.AWAITING_PAYMENT,
      },
    })

    return created({
      id: request.id,
      fee,
      doctorName: `د. ${doctor.firstName} ${doctor.lastName}`,
    })
  } catch (err) {
    console.error('[POST /api/instant-consult]', err)
    return serverError()
  }
}
