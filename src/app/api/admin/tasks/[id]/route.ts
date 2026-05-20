// src/app/api/admin/tasks/[id]/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'
import { z } from 'zod'

const UpdateSchema = z.object({
  status: z.enum(['IN_PROGRESS','COMPLETED','CANCELLED']).optional(),
  notes:  z.string().max(1000).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const { id }   = await params
    const body     = await req.json()
    const parsed   = UpdateSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const task = await db.adminTask.findUnique({ where: { id } })
    if (!task) return ok({ error: true, message: 'المهمة غير موجودة' })

    // الأدمن يمكنه فقط تحديث مهامه
    if (auth.context.role === Role.ADMIN && task.assignedTo !== auth.context.userId) {
      return ok({ error: true, message: 'غير مصرح' })
    }

    await db.adminTask.update({
      where: { id },
      data: {
        ...(parsed.data.status && { status: parsed.data.status }),
        ...(parsed.data.notes  && { notes:  parsed.data.notes }),
        ...(parsed.data.status === 'COMPLETED' && { completedAt: new Date() }),
      },
    })

    return ok({ message: 'تم تحديث المهمة' })
  } catch (err) {
    console.error('[PATCH /api/admin/tasks/[id]]', err)
    return serverError()
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    await db.adminTask.delete({ where: { id } })
    return ok({ message: 'تم حذف المهمة' })
  } catch (err) {
    console.error('[DELETE /api/admin/tasks/[id]]', err)
    return serverError()
  }
}
