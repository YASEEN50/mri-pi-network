import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, serverError } from '@/lib/api-response'
import { parsePiPaymentDto } from '@/lib/pi/pi-payment-dto'
import { processIncompletePiPayment } from '@/lib/pi/process-incomplete-payment'
import { getPiNetworkApiKey, PI_PAYMENTS_NOT_CONFIGURED_MSG } from '@/lib/pi/pi-api-key'
import { resolveIncompletePaymentActor } from '@/lib/pi/incomplete-payment-auth'
import { z } from 'zod'

const IncompleteSchema = z.object({
  payment: z.unknown(),
  accessToken: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    if (!getPiNetworkApiKey()) {
      return ok({ error: true, message: PI_PAYMENTS_NOT_CONFIGURED_MSG })
    }

    const body = await req.json()
    const parsed = IncompleteSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const payment = parsePiPaymentDto(parsed.data.payment)
    if (!payment) return ok({ error: true, message: 'بيانات الدفع غير صحيحة' })

    const sessionAuth = await requireAuth()
    const actor = await resolveIncompletePaymentActor(
      payment,
      sessionAuth.success ? sessionAuth : null,
      parsed.data.accessToken,
    )

    if (!actor) {
      return ok({
        error: true,
        message: 'يجب تسجيل الدخول لإكمال الدفع المعلق',
        code: 'AUTH_REQUIRED',
      })
    }

    const result = await processIncompletePiPayment(
      actor.userId,
      actor.role,
      payment,
    )

    return ok({ message: result.message })
  } catch (err) {
    console.error('[POST /api/payment/pi/incomplete]', err)
    const message = err instanceof Error ? err.message : 'فشل إكمال الدفع المعلق'
    return ok({ error: true, message })
  }
}
