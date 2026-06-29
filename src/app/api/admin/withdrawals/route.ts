import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { ok, fromAppError, serverError, fromZodError } from '@/lib/api-response'
import {
  listAdminWithdrawals,
  processWithdrawalByAdmin,
} from '@/lib/payment/doctor-withdrawal'

const ReviewSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['start', 'complete', 'reject']),
  txHash: z.string().min(8).max(128).optional(),
  rejectionReason: z.string().min(3).max(500).optional(),
})

export async function GET() {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canManageWithdrawals)
    if (!auth.success) return fromAppError(auth.error)

    const rows = await listAdminWithdrawals()
    return ok(rows)
  } catch (err) {
    console.error('[GET /api/admin/withdrawals]', err)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canManageWithdrawals)
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = ReviewSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    if (parsed.data.action === 'reject' && !parsed.data.rejectionReason?.trim()) {
      return ok({ error: true, message: 'سبب الرفض مطلوب' })
    }
    if (parsed.data.action === 'complete' && !parsed.data.txHash?.trim()) {
      return ok({ error: true, message: 'txid مطلوب لإتمام التحويل' })
    }

    const result = await processWithdrawalByAdmin(
      parsed.data.id,
      auth.context.userId,
      parsed.data.action,
      {
        txHash: parsed.data.txHash,
        rejectionReason: parsed.data.rejectionReason,
      },
    )

    if (!result.ok) return ok({ error: true, message: result.message })

    return ok({
      status: result.status,
      toAddress: result.toAddress,
      piPaymentId: result.piPaymentId,
    })
  } catch (err) {
    console.error('[POST /api/admin/withdrawals]', err)
    return serverError()
  }
}
