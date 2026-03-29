// =============================================================================
// src/app/api/admin/doctors/[id]/approve/route.ts
// POST /api/admin/doctors/[id]/approve  → { action: 'approve' | 'reject', notes? }
// =============================================================================

import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { container } from '@/infrastructure'
import { requireAuth } from '@/infrastructure/auth/providers/email-auth.provider'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { AdminRejectSchema } from '@/lib/validations/doctor.schema'
import { z } from 'zod'

const ApproveActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes:  z.string().min(10).max(500).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN] })
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = ApproveActionSchema.safeParse(body)
    if (!parsed.success) {
      const { fromZodError } = await import('@/lib/api-response')
      return fromZodError(parsed.error)
    }

    const { action, notes } = parsed.data

    if (action === 'approve') {
      const result = await container.approveDoctor.execute({
        doctorId: params.id,
        adminId: auth.context.userId,
      })
      if (!result.success) return fromAppError(result.error)
      return ok({ id: result.data.id, approvalStatus: result.data.approvalStatus, message: 'تمت الموافقة على الطبيب بنجاح' })
    }

    // reject
    if (!notes) {
      return fromAppError({ code: 'MISSING_NOTES', message: 'يجب إدخال سبب الرفض', statusCode: 400 } as any)
    }
    const result = await container.rejectDoctor.execute({
      doctorId: params.id,
      adminId: auth.context.userId,
      notes,
    })
    if (!result.success) return fromAppError(result.error)
    return ok({ id: result.data.id, approvalStatus: result.data.approvalStatus, message: 'تم رفض طلب الطبيب' })
  } catch (err) {
    console.error('[POST /api/admin/doctors/[id]/approve]', err)
    return serverError()
  }
}
