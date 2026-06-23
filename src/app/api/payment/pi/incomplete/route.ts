import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { parsePiPaymentDto } from '@/lib/pi/pi-payment-dto'
import { processIncompletePiPayment } from '@/lib/pi/process-incomplete-payment'
import { getPiNetworkApiKey } from '@/lib/pi/pi-api-key'

export async function POST(req: NextRequest) {
  try {
    if (!getPiNetworkApiKey()) {
      return ok({
        error: true,
        message: 'PI_NETWORK_API_KEY غير مُعدّ على الخادم',
      })
    }

    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const payment = parsePiPaymentDto(body.payment)
    if (!payment) return ok({ error: true, message: 'بيانات الدفع غير صحيحة' })

    const result = await processIncompletePiPayment(
      auth.context.userId,
      auth.context.role,
      payment,
    )

    return ok({ message: result.message })
  } catch (err) {
    console.error('[POST /api/payment/pi/incomplete]', err)
    const message = err instanceof Error ? err.message : 'فشل إكمال الدفع المعلق'
    return ok({ error: true, message })
  }
}
