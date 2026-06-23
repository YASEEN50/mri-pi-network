// src/app/api/auth/pi-login/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, parseBody, serverError } from '@/lib/api-response'
import { PiLoginSchema } from '@/lib/validations/auth.schema'
import { UnauthorizedError } from '@/core/errors'
import { verifyPiAccessToken } from '@/lib/pi/verify-access-token'
import { resolvePiLoginUser } from '@/lib/auth/account-linking'

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const parsed = parseBody(PiLoginSchema, body)
    if (!parsed.success) return parsed.response

    const piUser = await verifyPiAccessToken(parsed.data.accessToken)
    if (!piUser) return fromAppError(new UnauthorizedError('فشل التحقق من حساب Pi Network'))

    const user = await resolvePiLoginUser(piUser)

    const fullUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        clientProfile:   { select: { id: true } },
        doctorProfile:   { select: { id: true } },
        facilityProfile: { select: { id: true } },
      },
    })

    const isProfileComplete = !!(fullUser.clientProfile || fullUser.doctorProfile || fullUser.facilityProfile)

    return ok({
      userId:            fullUser.id,
      piUid:             fullUser.piUid,
      piUsername:        fullUser.piUsername,
      role:              fullUser.role,
      isNewUser:         !isProfileComplete,
      isProfileComplete,
    })
  } catch (err) {
    console.error('[POST /api/auth/pi-login]', err)
    return serverError()
  }
}
