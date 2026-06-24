import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError, fromZodError } from '@/lib/api-response'
import { deleteUserAccount } from '@/lib/privacy/delete-user-account'
import { AppError } from '@/core/errors'

const Schema = z.object({
  confirmPhrase: z.literal('DELETE', {
    errorMap: () => ({ message: 'اكتب DELETE للتأكيد' }),
  }),
  password: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    await deleteUserAccount({
      userId: auth.context.userId,
      confirmPhrase: parsed.data.confirmPhrase,
      password: parsed.data.password,
    })

    return ok({ message: 'تم حذف حسابك بنجاح', redirectTo: '/' })
  } catch (err) {
    if (err instanceof AppError) return fromAppError(err)
    console.error('[POST /api/account/delete]', err)
    return serverError()
  }
}
