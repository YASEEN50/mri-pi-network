import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { ForbiddenError } from '@/core/errors'
import {
  buildOtpAuthUrl,
  encryptSecretForStorage,
  generateTotpSecret,
  qrDataUrl,
} from '@/lib/mfa/totp'

const PENDING_PREFIX = 'mfa-pending:'

export async function POST(_req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const user = await prisma.user.findUnique({
      where: { id: auth.context.userId },
      select: { email: true, mfaEnabled: true },
    })
    if (!user) return fromAppError(new ForbiddenError())
    if (user.mfaEnabled) {
      return ok({ error: true, message: 'MFA مفعّل مسبقاً' })
    }

    const secret = generateTotpSecret()
    const otpauthUrl = buildOtpAuthUrl(user.email ?? auth.context.userId, secret)
    const qr = await qrDataUrl(otpauthUrl)

    await prisma.verificationToken.deleteMany({
      where: { identifier: `${PENDING_PREFIX}${auth.context.userId}` },
    })
    await prisma.verificationToken.create({
      data: {
        identifier: `${PENDING_PREFIX}${auth.context.userId}`,
        token: encryptSecretForStorage(secret),
        expires: new Date(Date.now() + 10 * 60 * 1000),
      },
    })

    return ok({
      otpauthUrl,
      qrDataUrl: qr,
      secret,
    })
  } catch (err) {
    console.error('[POST /api/mfa/setup]', err)
    return serverError()
  }
}
