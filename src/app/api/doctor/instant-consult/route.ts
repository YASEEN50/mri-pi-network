import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError, fromZodError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

const SettingsSchema = z.object({
  acceptsInstantConsult: z.boolean().optional(),
  isOnlineForInstant: z.boolean().optional(),
  instantConsultFee: z.number().positive().max(1_000_000).optional(),
  instantConsultDurationMinutes: z.number().int().min(5).max(60).optional(),
})

export async function GET() {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: auth.context.userId },
      select: {
        acceptsInstantConsult: true,
        isOnlineForInstant: true,
        instantConsultFee: true,
        instantConsultDurationMinutes: true,
      },
    })
    if (!doctor) return ok(null)

    return ok({
      acceptsInstantConsult: doctor.acceptsInstantConsult,
      isOnlineForInstant: doctor.isOnlineForInstant,
      instantConsultFee: doctor.instantConsultFee ? Number(doctor.instantConsultFee) : null,
      instantConsultDurationMinutes: doctor.instantConsultDurationMinutes,
    })
  } catch (err) {
    console.error('[GET /api/doctor/instant-consult]', err)
    return serverError()
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const parsed = SettingsSchema.safeParse(await req.json())
    if (!parsed.success) return fromZodError(parsed.error)

    const updated = await prisma.doctorProfile.update({
      where: { userId: auth.context.userId },
      data: parsed.data,
      select: {
        acceptsInstantConsult: true,
        isOnlineForInstant: true,
        instantConsultFee: true,
        instantConsultDurationMinutes: true,
      },
    })

    return ok({
      acceptsInstantConsult: updated.acceptsInstantConsult,
      isOnlineForInstant: updated.isOnlineForInstant,
      instantConsultFee: updated.instantConsultFee ? Number(updated.instantConsultFee) : null,
      instantConsultDurationMinutes: updated.instantConsultDurationMinutes,
    })
  } catch (err) {
    console.error('[PATCH /api/doctor/instant-consult]', err)
    return serverError()
  }
}
