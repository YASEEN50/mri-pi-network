import { NextRequest } from 'next/server'
import { z } from 'zod'
import { compare } from 'bcryptjs'
import { ok, serverError, fromZodError } from '@/lib/api-response'
import { findUserByAuthEmail } from '@/lib/auth/find-user-by-email'
import { normalizeAuthEmail } from '@/lib/auth/normalize-email'
import { createMfaChallengeToken } from '@/lib/mfa/challenge-token'
import { requiresMfaRole } from '@/lib/mfa/session-flags'

const Schema = z.object({
  email: z.string().trim().email().transform(normalizeAuthEmail),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const { email, password } = parsed.data

    const user = await findUserByAuthEmail(email, {
      id: true,
      passwordHash: true,
      isActive: true,
      role: true,
      mfaEnabled: true,
    })

    if (!user?.isActive) {
      return ok({ error: true, message: 'INVALID_CREDENTIALS' })
    }

    if (!user.passwordHash) {
      if (requiresMfaRole(user.role) && user.mfaEnabled) {
        return ok({ error: true, message: 'PASSWORD_NOT_SET' })
      }
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
