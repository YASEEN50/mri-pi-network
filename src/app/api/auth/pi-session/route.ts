import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { ok, fromZodError, serverError } from '@/lib/api-response'
import { establishPiSession } from '@/lib/auth/pi-session'
import { sessionCookieName, sessionCookieOptions, SESSION_MAX_AGE_SEC } from '@/lib/auth/cookie-options'

const BodySchema = z.object({
  accessToken: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const result = await establishPiSession(parsed.data.accessToken)
    if (!result.ok) {
      return NextResponse.json(
        { success: false, data: { error: true, code: result.code, message: result.message } },
        { status: result.status },
      )
    }

    const cookieStore = await cookies()
    cookieStore.set(
      sessionCookieName(),
      result.encodedToken,
      sessionCookieOptions(SESSION_MAX_AGE_SEC),
    )

    return ok({
      userId: result.user.id,
      role: result.user.role,
      isProfileComplete: result.user.isProfileComplete,
      piUsername: result.user.piUsername,
      redirectPath: result.redirectPath,
    })
  } catch (err) {
    console.error('[POST /api/auth/pi-session]', err)
    return serverError()
  }
}
