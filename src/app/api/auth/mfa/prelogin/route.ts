import { NextRequest } from 'next/server'
import { z } from 'zod'
import { compare } from 'bcryptjs'
import { Role } from '@prisma/client'
import { ok, serverError, fromZodError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { createMfaChallengeToken } from '@/lib/mfa/challenge-token'
import { requiresMfaRole } from '@/lib/mfa/session-flags'
import { normalizeAuthEmail } from '@/lib/auth/normalize-email'

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const { email, password } = parsed.data
    const normalizedEmail = normalizeAuthEmail(email)

    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
      select: {
        id: true,
        passwordHash: true,
        isActive: true,
        role: true,
        mfaEnabled: true,
      },
    })

    if (!user?.passwordHash || !user.isActive) {
      return ok({ error: true, message: 'INVALID_CREDENTIALS' })
    }

    const valid = await compare(password, user.passwordHash)
    if (!valid) {
      return ok({ error: true, message: 'INVALID_CREDENTIALS' })
    }

    if (requiresMfaRole(user.role) && user.mfaEnabled) {
      return ok({
        mfaRequired: true,
        challengeToken: createMfaChallengeToken(user.id),
      })
    }

    return ok({ mfaRequired: false })
  } catch (err) {
    console.error('[POST /api/auth/mfa/prelogin]', err)
    return serverError()
  }
}
