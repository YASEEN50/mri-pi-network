import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError, fromZodError } from '@/lib/api-response'
import {
  listDoctorWithdrawals,
  requestDoctorWithdrawal,
} from '@/lib/payment/doctor-withdrawal'

const CreateSchema = z.object({
  amount: z.number().positive(),
})

export async function GET() {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const data = await listDoctorWithdrawals(auth.context.userId)
    return ok(data)
  } catch (err) {
    console.error('[GET /api/doctor/withdrawals]', err)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const result = await requestDoctorWithdrawal(auth.context.userId, parsed.data.amount)
    if (!result.ok) return ok({ error: true, message: result.message })

    return ok({ id: result.id, message: 'تم إرسال طلب السحب — بانتظار موافقة الإدارة' })
  } catch (err) {
    console.error('[POST /api/doctor/withdrawals]', err)
    return serverError()
  }
}
