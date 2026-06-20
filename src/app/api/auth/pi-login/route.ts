// src/app/api/auth/pi-login/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, parseBody, serverError } from '@/lib/api-response'
import { PiLoginSchema } from '@/lib/validations/auth.schema'
import { UnauthorizedError } from '@/core/errors'
import { Role } from '@prisma/client'
import { verifyPiAccessToken } from '@/lib/pi/verify-access-token'

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const parsed = parseBody(PiLoginSchema, body)
    if (!parsed.success) return parsed.response

    const piUser = await verifyPiAccessToken(parsed.data.accessToken)
    if (!piUser) return fromAppError(new UnauthorizedError('فشل التحقق من حساب Pi Network'))

    const user = await prisma.user.upsert({
      where: { piUid: piUser.uid },
      update: { piUsername: piUser.username, updatedAt: new Date() },
      create: {
        piUid:      piUser.uid,
        piUsername: piUser.username,
        role:       Role.CLIENT,
        isActive:   true,
      },
      include: {
        clientProfile:   { select: { id: true } },
        doctorProfile:   { select: { id: true } },
        facilityProfile: { select: { id: true } },
      },
    })

    const isProfileComplete = !!(user.clientProfile || user.doctorProfile || user.facilityProfile)

    return ok({
      userId:            user.id,
      piUid:             user.piUid,
      piUsername:        user.piUsername,
      role:              user.role,
      isNewUser:         !isProfileComplete,
      isProfileComplete,
    })
  } catch (err) {
    console.error('[POST /api/auth/pi-login]', err)
    return serverError()
  }
}
