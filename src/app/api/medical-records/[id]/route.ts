// src/app/api/medical-records/[id]/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { db } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { canAccessMedicalRecord } from '@/lib/medical-records/access'
import { deleteMedicalRecordFile } from '@/lib/medical-records/storage'
import { writeMedicalRecordAudit } from '@/lib/medical-records/audit'

const UpdateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
  isShared: z.boolean().optional(),
  sharedUntil: z.string().datetime().optional(),
  shareConsent: z.boolean().optional(),
})

function clientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const record = await db.medicalRecord.findFirst({ where: { id, deletedAt: null } })
    if (!record) return ok({ error: true, message: 'السجل غير موجود' })

    const allowed = await canAccessMedicalRecord(auth.context, record)
    if (!allowed || auth.context.role !== Role.CLIENT) {
      return ok({ error: true, message: 'غير مصرح' })
    }

    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    if (parsed.data.isShared === true && !parsed.data.shareConsent) {
      return ok({
        error: true,
        message: 'يجب الموافقة على مشاركة السجل الطبي مع الأطباء المعالجين',
      })
    }

    const wasShared = record.isShared
    const willShare = parsed.data.isShared ?? record.isShared

    await db.medicalRecord.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.isShared !== undefined && { isShared: parsed.data.isShared }),
        ...(parsed.data.sharedUntil !== undefined && { sharedUntil: new Date(parsed.data.sharedUntil) }),
      },
    })

    let action: 'MEDICAL_RECORD_UPDATE' | 'MEDICAL_RECORD_SHARE' | 'MEDICAL_RECORD_UNSHARE' =
      'MEDICAL_RECORD_UPDATE'
    if (!wasShared && willShare) action = 'MEDICAL_RECORD_SHARE'
    if (wasShared && parsed.data.isShared === false) action = 'MEDICAL_RECORD_UNSHARE'

    await writeMedicalRecordAudit({
      actorId: auth.context.userId,
      actorRole: auth.context.role,
      action,
      recordId: id,
      ip: clientIp(req),
      userAgent: req.headers.get('user-agent'),
    })

    return ok({ message: 'تم تحديث السجل' })
  } catch (err) {
    console.error('[PATCH /api/medical-records/[id]]', err)
    return serverError()
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { id } = await params
    const record = await db.medicalRecord.findFirst({ where: { id, deletedAt: null } })
    if (!record) return ok({ error: true, message: 'السجل غير موجود' })

    const allowed = await canAccessMedicalRecord(auth.context, record)
    if (!allowed || auth.context.role !== Role.CLIENT) {
      return ok({ error: true, message: 'غير مصرح' })
    }

    await db.medicalRecord.update({ where: { id }, data: { deletedAt: new Date() } })
    if (record.fileUrl) {
      await deleteMedicalRecordFile(record.id, record.fileType)
    }

    await writeMedicalRecordAudit({
      actorId: auth.context.userId,
      actorRole: auth.context.role,
      action: 'MEDICAL_RECORD_DELETE',
      recordId: id,
      ip: clientIp(req),
      userAgent: req.headers.get('user-agent'),
    })

    return ok({ message: 'تم حذف السجل' })
  } catch (err) {
    console.error('[DELETE /api/medical-records/[id]]', err)
    return serverError()
  }
}
