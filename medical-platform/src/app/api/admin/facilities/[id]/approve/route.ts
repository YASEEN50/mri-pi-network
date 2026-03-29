// =============================================================================
// src/app/api/admin/facilities/[id]/approve/route.ts
// POST /api/admin/facilities/[id]/approve
// =============================================================================

import { NextRequest } from 'next/server'
import { Role, ApprovalStatus } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/email-auth.provider'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { container } from '@/infrastructure'
import { prisma } from '@/infrastructure/database/prisma/client'
import { NotFoundError, ForbiddenError, BusinessRuleError } from '@/core/errors'
import { z } from 'zod'

const ActionSchema = z.object({
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
    const parsed = ActionSchema.safeParse(body)
    if (!parsed.success) {
      const { fromZodError } = await import('@/lib/api-response')
      return fromZodError(parsed.error)
    }

    const { action, notes } = parsed.data

    const facility = await prisma.facilityProfile.findUnique({
      where: { id: params.id, deletedAt: null },
    })
    if (!facility) return fromAppError(new NotFoundError('المنشأة', params.id))

    if (facility.approvalStatus !== ApprovalStatus.DOCUMENTS_REVIEW) {
      return fromAppError(new BusinessRuleError('يمكن مراجعة المنشآت في حالة DOCUMENTS_REVIEW فقط'))
    }

    if (action === 'approve') {
      const updated = await container.facilityRepo.updateApprovalStatus(
        params.id,
        ApprovalStatus.APPROVED,
        auth.context.userId
      )
      return ok({ id: updated.id, approvalStatus: updated.approvalStatus, message: 'تمت الموافقة على المنشأة بنجاح' })
    }

    // reject
    if (!notes) {
      return fromAppError({ code: 'MISSING_NOTES', message: 'يجب إدخال سبب الرفض', statusCode: 400 } as any)
    }
    const updated = await container.facilityRepo.updateApprovalStatus(
      params.id,
      ApprovalStatus.REJECTED,
      auth.context.userId,
      notes
    )
    return ok({ id: updated.id, approvalStatus: updated.approvalStatus, message: 'تم رفض طلب المنشأة' })
  } catch (err) {
    console.error('[POST /api/admin/facilities/[id]/approve]', err)
    return serverError()
  }
}
