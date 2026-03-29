// =============================================================================
// src/app/api/auth/pi-login/route.ts
// =============================================================================

import { NextRequest } from 'next/server'
import { PiAuthProvider } from '@/infrastructure/auth/providers/email-auth.provider'
import { ok, fromAppError, parseBody, serverError } from '@/lib/api-response'
import { PiLoginSchema } from '@/lib/validations/auth.schema'
import { UnauthorizedError } from '@/core/errors'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = parseBody(PiLoginSchema, body)
    if (!parsed.success) return parsed.response

    const provider = new PiAuthProvider()
    const result = await provider.authenticate(parsed.data.accessToken)

    if (!result) return fromAppError(new UnauthorizedError('فشل التحقق من حساب Pi Network'))

    return ok({
      userId: result.id,
      piUid: result.piUid,
      piUsername: result.piUsername,
      role: result.role,
      isNewUser: result.isNewUser,
      isProfileComplete: result.isProfileComplete,
    })
  } catch (err) {
    console.error('[POST /api/auth/pi-login]', err)
    return serverError()
  }
}
