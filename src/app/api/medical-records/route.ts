// src/app/api/medical-records/route.ts
import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { validateFileBuffer } from '@/lib/verification/file-validator'
import type { AllowedMimeType } from '@/core/interfaces/services/file-storage.interface'
import { doctorSharedRecordsWhere } from '@/lib/medical-records/access'
import { saveMedicalRecordFile, medicalRecordFileUrl, deleteMedicalRecordFile } from '@/lib/medical-records/storage'
import { writeMedicalRecordAudit } from '@/lib/medical-records/audit'

export const runtime = 'nodejs'
export const maxDuration = 30

const CreateJsonSchema = z.object({
  type: z.enum(['PRESCRIPTION', 'LAB_RESULT', 'RADIOLOGY_REPORT', 'DIAGNOSIS', 'DISCHARGE_SUMMARY', 'VACCINATION', 'OTHER']),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  appointmentId: z.string().uuid().optional(),
  isShared: z.boolean().default(false),
  shareConsent: z.boolean().optional(),
  clientId: z.string().uuid().optional(),
})

function clientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { userId, role } = auth.context
    const type = req.nextUrl.searchParams.get('type')
    const shared = req.nextUrl.searchParams.get('shared') === 'true'

    let where: Record<string, unknown> = { deletedAt: null }

    if (role === Role.CLIENT) {
      const profile = await prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } })
      if (!profile) return ok([])
      where.clientId = profile.id
    } else if (role === Role.DOCTOR) {
      const doctorWhere = await doctorSharedRecordsWhere(userId)
      if (!doctorWhere) return ok([])
      where = { ...where, ...doctorWhere }
    } else if (role === Role.ADMIN || role === Role.OWNER) {
      // Admin/owner — full list with audit per record below
    } else {
      return ok([])
    }

    if (type) where.type = type
    if (shared) where.isShared = true

    const records = await db.medicalRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        doctor: { select: { firstName: true, lastName: true, specialization: true } },
        appointment: { select: { scheduledAt: true, type: true } },
      },
    })

    if (records.length > 0) {
      await writeMedicalRecordAudit({
        actorId: userId,
        actorRole: role,
        action: 'MEDICAL_RECORD_LIST',
        recordId: records[0].id,
        payload: { count: records.length },
        ip: clientIp(req),
        userAgent: req.headers.get('user-agent'),
      })
    }

    return ok(
      records.map((r: {
        id: string
        type: string
        title: string
        description: string | null
        fileUrl: string | null
        fileType: string | null
        isShared: boolean
        sharedUntil: Date | null
        createdAt: Date
        doctor: { firstName: string; lastName: string; specialization: string } | null
        appointment: { scheduledAt: Date; type: string } | null
      }) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        description: r.description,
        fileUrl: r.fileUrl,
        fileType: r.fileType,
        isShared: r.isShared,
        sharedUntil: r.sharedUntil,
        createdAt: r.createdAt,
        doctor: r.doctor ? `د. ${r.doctor.firstName} ${r.doctor.lastName}` : null,
        doctorSpecialty: r.doctor?.specialization ?? null,
        appointmentDate: r.appointment?.scheduledAt ?? null,
      }))
    )
  } catch (err) {
    console.error('[GET /api/medical-records]', err)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.CLIENT, Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const contentType = req.headers.get('content-type') ?? ''
    let parsed: z.infer<typeof CreateJsonSchema>
    let fileBuffer: Buffer | null = null
    let fileMime: AllowedMimeType | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const raw = {
        type: String(formData.get('type') ?? 'OTHER'),
        title: String(formData.get('title') ?? ''),
        description: String(formData.get('description') ?? '') || undefined,
        appointmentId: String(formData.get('appointmentId') ?? '') || undefined,
        isShared: formData.get('isShared') === 'true',
        shareConsent: formData.get('shareConsent') === 'true',
        clientId: String(formData.get('clientId') ?? '') || undefined,
      }
      const result = CreateJsonSchema.safeParse(raw)
      if (!result.success) return ok({ error: true, message: 'بيانات غير صحيحة' })
      parsed = result.data

      const file = formData.get('file') as File | null
      if (file && file.size > 0) {
        fileBuffer = Buffer.from(await file.arrayBuffer())
        const validation = validateFileBuffer(fileBuffer)
        if (!validation.valid || !validation.mimeType) {
          return ok({ error: true, message: validation.error ?? 'ملف غير صالح' })
        }
        fileMime = validation.mimeType as AllowedMimeType
      }
    } else {
      const body = await req.json()
      const result = CreateJsonSchema.safeParse(body)
      if (!result.success) return ok({ error: true, message: 'بيانات غير صحيحة' })
      parsed = result.data
    }

    if (parsed.isShared && !parsed.shareConsent) {
      return ok({
        error: true,
        message: 'يجب الموافقة على مشاركة السجل الطبي مع الأطباء المعالجين',
      })
    }

    const { userId, role } = auth.context
    let clientId: string | null = null
    let doctorId: string | null = null

    if (role === Role.CLIENT) {
      const profile = await prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } })
      if (!profile) return ok({ error: true, message: 'ملف المريض غير موجود' })
      clientId = profile.id
    } else if (role === Role.DOCTOR) {
      const doctor = await prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true } })
      if (!doctor) return ok({ error: true, message: 'ملف الطبيب غير موجود' })
      doctorId = doctor.id
      clientId = parsed.clientId ?? null
      if (!clientId) return ok({ error: true, message: 'يجب تحديد المريض' })
    }

    const recordId = randomUUID()

    if (fileBuffer && fileMime) {
      await saveMedicalRecordFile(recordId, fileBuffer, fileMime)
    }

    const record = await db.medicalRecord.create({
      data: {
        id: recordId,
        clientId: clientId!,
        doctorId: doctorId ?? undefined,
        appointmentId: parsed.appointmentId,
        type: parsed.type,
        title: parsed.title,
        description: parsed.description,
        fileUrl: fileBuffer && fileMime ? medicalRecordFileUrl(recordId) : undefined,
        fileType: fileMime ?? undefined,
        isShared: parsed.isShared,
      },
    })

    await writeMedicalRecordAudit({
      actorId: userId,
      actorRole: role,
      action: parsed.isShared ? 'MEDICAL_RECORD_SHARE' : 'MEDICAL_RECORD_CREATE',
      recordId: record.id,
      payload: { hasFile: !!fileBuffer, isShared: parsed.isShared },
      ip: clientIp(req),
      userAgent: req.headers.get('user-agent'),
    })

    return created({ id: record.id })
  } catch (err) {
    console.error('[POST /api/medical-records]', err)
    return serverError()
  }
}
