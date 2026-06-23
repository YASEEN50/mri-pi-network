import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { verifyPiAccessToken } from '@/lib/pi/verify-access-token'
import { linkPiToUser } from '@/lib/auth/account-linking'
import { z } from 'zod'

const Schema = z.object({
  accessToken: z.string().min(1),
})

const ERROR_MESSAGES: Record<string, string> = {
  PI_ALREADY_LINKED: 'حسابك مرتبط بـ Pi بالفعل',
  PI_USED_BY_OTHER: 'حساب Pi هذا مرتبط بمستخدم آخر',
  USER_NOT_FOUND: 'المستخدم غير موجود',
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'رمز Pi غير صالح' })

    const piUser = await verifyPiAccessToken(parsed.data.accessToken)
    if (!piUser) return ok({ error: true, message: 'فشل التحقق من حساب Pi Network' })

    const user = await linkPiToUser(auth.context.userId, piUser)

    return ok({
      message: 'تم ربط حساب Pi بنجاح',
      piUid: user.piUid,
      piUsername: user.piUsername,
    })
  } catch (err) {
    if (err instanceof Error && ERROR_MESSAGES[err.message]) {
      return ok({ error: true, message: ERROR_MESSAGES[err.message] })
    }
    console.error('[POST /api/auth/link-pi]', err)
    return serverError()
  }
}
