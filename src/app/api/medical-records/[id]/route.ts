// src/app/api/medical-records/[id]/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'
import { z } from 'zod'

const UpdateSchema = z.object({
  title:       z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
  isShared:    z.boolean().optional(),
  sharedUntil: z.string().datetime().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { id }     = await params
    const { userId, role } = auth.context

    const record = await db.medicalRecord.findFirst({ where: { id, deletedAt: null } })
    if (!record) return ok({ error: true, message: 'السجل غير موجود' })

    // التحقق من الملكية
    if (role === Role.CLIENT) {
      const profile = await prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } })
      if (!profile || record.clientId !== profile.id) return ok({ error: true, message: 'غير مصرح' })
    }

    const body   = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    await db.medicalRecord.update({
      where: { id },
      data: {
        ...(parsed.data.title       !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.isShared    !== undefined && { isShared: parsed.data.isShared }),
        ...(parsed.data.sharedUntil !== undefined && { sharedUntil: new Date(parsed.data.sharedUntil) }),
      },
    })

    return ok({ message: 'تم تحديث السجل' })
  } catch (err) {
    console.error('[PATCH /api/medical-records/[id]]', err)
    return serverError()
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const { userId, role } = auth.context

    const record = await db.medicalRecord.findFirst({ where: { id, deletedAt: null } })
    if (!record) return ok({ error: true, message: 'السجل غير موجود' })

    if (role === Role.CLIENT) {
      const profile = await prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } })
      if (!profile || record.clientId !== profile.id) return ok({ error: true, message: 'غير مصرح' })
    }

    await db.medicalRecord.update({ where: { id }, data: { deletedAt: new Date() } })
    return ok({ message: 'تم حذف السجل' })
  } catch (err) {
    console.error('[DELETE /api/medical-records/[id]]', err)
    return serverError()
  }
}
