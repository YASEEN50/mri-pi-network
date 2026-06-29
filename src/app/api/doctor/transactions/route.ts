import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { listDoctorTransactions } from '@/lib/payment/doctor-transactions'

export async function GET() {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const data = await listDoctorTransactions(auth.context.userId)
    return ok(data)
  } catch (err) {
    console.error('[GET /api/doctor/transactions]', err)
    return serverError()
  }
}
