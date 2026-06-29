import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Role, InstantConsultStatus } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, created, fromAppError, serverError, fromZodError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import {
  doctorHasActiveInstantSession,
  expireStaleInstantConsults,
  listAvailableInstantDoctors,
} from '@/lib/instant-consult/service'

const DirectCreateSchema = z.object({
  doctorId: z.string().uuid(),
  reason: z.string().min(3).max(500).optional(),
})

const BroadcastCreateSchema = z.object({
  broadcast: z.literal(true),
  specialization: z.string().min(2).max(120),
  reason: z.string().min(3).max(500).optional(),
})

const CreateSchema = z.union([DirectCreateSchema, BroadcastCreateSchema])

function mapClientRequest(r: {
  id: string
  status: InstantConsultStatus
  reason: string | null
  fee: { toNumber?: () => number } | number | bigint
  isPaid: boolean
  isBroadcast: boolean
  targetSpecialization: string | null
  expiresAt: Date | null
  sessionEndsAt: Date | null
  chatRoomId: string | null
  doctorId: string | null
  createdAt: Date
  doctor: {
    firstName: string
    lastName: string
    specialization: string
    avatarUrl: string | null
  } | null
  review?: { id: string } | null
}) {
  return {
    id: r.id,
    status: r.status,
    reason: r.reason,
    fee: Number(r.fee),
    isPaid: r.isPaid,
    isBroadcast: r.isBroadcast,
    targetSpecialization: r.targetSpecialization,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    sessionEndsAt: r.sessionEndsAt?.toISOString() ?? null,
    chatRoomId: r.chatRoomId,
    doctorId: r.doctorId,
    hasReview: !!r.review,
    doctor: r.doctor
      ? {
          fullName: `د. ${r.doctor.firstName} ${r.doctor.lastName}`,
          specialization: r.doctor.specialization,
          avatarUrl: r.doctor.avatarUrl,
        }
      : {
          fullName: `⚡ بث: ${r.targetSpecialization ?? 'أطباء متاحون'}`,
          specialization: r.targetSpecialization,
          avatarUrl: null,
        },
    createdAt: r.createdAt.toISOString(),
  }
}

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
          review: { select: { id: true } },
        },
      })

      return ok(requests.map(mapClientRequest))
    }

    if (role === Role.DOCTOR) {
      const doctor = await prisma.doctorProfile.findUnique({
        where: { userId },
        select: { id: true, specialization: true },
      })
      if (!doctor) return ok([])

      const requests = await prisma.instantConsultRequest.findMany({
        where: {
          status: { in: [InstantConsultStatus.PENDING, InstantConsultStatus.ACCEPTED] },
          OR: [
            { doctorId: doctor.id },
            {
              isBroadcast: true,
              doctorId: null,
              targetSpecialization: {
                contains: doctor.specialization,
                mode: 'insensitive',
              },
            },
          ],
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
          isBroadcast: r.isBroadcast,
          targetSpecialization: r.targetSpecialization,
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

    const body = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const profile = await prisma.clientProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { id: true },
    })
    if (!profile) return ok({ error: true, message: 'أكمل ملفك الشخصي أولاً' })

    const activeClientRequest = await prisma.instantConsultRequest.findFirst({
      where: {
        clientId: profile.id,
        status: {
          in: [
            InstantConsultStatus.AWAITING_PAYMENT,
            InstantConsultStatus.PENDING,
            InstantConsultStatus.ACCEPTED,
          ],
        },
      },
    })
    if (activeClientRequest) {
      return ok({
        error: true,
        message: 'لديك طلب استشارة نشط — أكمله أو انتظر انتهاءه',
        requestId: activeClientRequest.id,
      })
    }

    if ('broadcast' in parsed.data && parsed.data.broadcast) {
      const available = await listAvailableInstantDoctors(parsed.data.specialization)
      if (available.length === 0) {
        return ok({ error: true, message: 'لا يوجد أطباء متاحون في هذا التخصص الآن' })
      }

      const fee = Math.max(...available.map((d) => d.fee))
      const request = await prisma.instantConsultRequest.create({
        data: {
          clientId: profile.id,
          reason: parsed.data.reason,
          fee,
          isBroadcast: true,
          targetSpecialization: parsed.data.specialization,
          status: InstantConsultStatus.AWAITING_PAYMENT,
        },
      })

      return created({
        id: request.id,
        fee,
        isBroadcast: true,
        specialization: parsed.data.specialization,
        doctorsNotified: available.length,
      })
    }

    const { doctorId, reason } = parsed.data as { doctorId: string; reason?: string }

    const doctor = await prisma.doctorProfile.findFirst({
      where: {
        id: doctorId,
        deletedAt: null,
        approvalStatus: 'APPROVED',
        acceptsInstantConsult: true,
        isOnlineForInstant: true,
        instantConsultFee: { not: null, gt: 0 },
      },
      select: { id: true, instantConsultFee: true, firstName: true, lastName: true },
    })
    if (!doctor) return ok({ error: true, message: 'الطبيب غير متاح للاستشارة الفورية' })

    if (await doctorHasActiveInstantSession(doctor.id)) {
      return ok({ error: true, message: 'الطبيب مشغول في استشارة أخرى — جرّب طبيباً آخر' })
    }

    const fee = Number(doctor.instantConsultFee)
    const request = await prisma.instantConsultRequest.create({
      data: {
        clientId: profile.id,
        doctorId: doctor.id,
        reason,
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
