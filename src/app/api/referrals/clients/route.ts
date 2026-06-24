import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

/** Clients the doctor can refer (confirmed/completed appointments) */
export async function GET(_req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { id: true },
    })
    if (!doctor) return ok([])

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        deletedAt: null,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 100,
      select: {
        clientId: true,
        client: {
          select: {
            clientProfile: { select: { firstName: true, lastName: true } },
            email: true,
            piUsername: true,
          },
        },
      },
      distinct: ['clientId'],
    })

    return ok(
      appointments.map(a => {
        const profile = a.client.clientProfile
        const name = profile
          ? `${profile.firstName} ${profile.lastName}`
          : a.client.piUsername ?? a.client.email ?? 'مريض'
        return { clientId: a.clientId, name }
      }),
    )
  } catch (err) {
    console.error('[GET /api/referrals/clients]', err)
    return serverError()
  }
}
