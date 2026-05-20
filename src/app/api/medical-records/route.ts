// src/app/api/medical-records/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma, db } from '@/lib/prisma'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'
import { z } from 'zod'

// RecordType enum حتى يُشغَّل prisma generate
const RecordTypeEnum = {
  PRESCRIPTION: 'PRESCRIPTION', LAB_RESULT: 'LAB_RESULT',
  RADIOLOGY_REPORT: 'RADIOLOGY_REPORT', DIAGNOSIS: 'DIAGNOSIS',
  DISCHARGE_SUMMARY: 'DISCHARGE_SUMMARY', VACCINATION: 'VACCINATION', OTHER: 'OTHER',
} as const

const CreateSchema = z.object({
  type:          z.enum(['PRESCRIPTION','LAB_RESULT','RADIOLOGY_REPORT','DIAGNOSIS','DISCHARGE_SUMMARY','VACCINATION','OTHER']),
  title:         z.string().min(2).max(200),
  description:   z.string().max(2000).optional(),
  fileUrl:       z.string().url().optional(),
  fileType:      z.string().optional(),
  appointmentId: z.string().uuid().optional(),
  isShared:      z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { userId, role } = auth.context
    const type    = req.nextUrl.searchParams.get('type')
    const shared  = req.nextUrl.searchParams.get('shared') === 'true'

    let where: any = { deletedAt: null }

    if (role === Role.CLIENT) {
      const profile = await prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } })
      if (!profile) return ok([])
      where.clientId = profile.id
    } else if (role === Role.DOCTOR) {
      // الطبيب يرى السجلات المشاركة معه فقط
      const doctor = await prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true } })
      if (!doctor) return ok([])
      where = { ...where, doctorId: doctor.id, isShared: true }
    } else if (role === Role.ADMIN || role === Role.OWNER) {
      // Admin يرى الكل
    }

    if (type)   where.type     = type
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

    return ok(records.map((r: any) => ({
      id:          r.id,
      type:        r.type,
      title:       r.title,
      description: r.description,
      fileUrl:     r.fileUrl,
      fileType:    r.fileType,
      isShared:    r.isShared,
      sharedUntil: r.sharedUntil,
      createdAt:   r.createdAt,
      doctor:      r.doctor ? `د. ${r.doctor.firstName} ${r.doctor.lastName}` : null,
      doctorSpecialty: r.doctor?.specialization ?? null,
      appointmentDate: r.appointment?.scheduledAt ?? null,
    })))
  } catch (err) {
    console.error('[GET /api/medical-records]', err)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.CLIENT, Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const body   = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

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
      // الطبيب يجب أن يحدد clientId
      clientId = body.clientId ?? null
      if (!clientId) return ok({ error: true, message: 'يجب تحديد المريض' })
    }

    const record = await db.medicalRecord.create({
      data: {
        clientId:      clientId!,
        doctorId:      doctorId ?? undefined,
        appointmentId: parsed.data.appointmentId,
        type:          parsed.data.type,
        title:         parsed.data.title,
        description:   parsed.data.description,
        fileUrl:       parsed.data.fileUrl,
        fileType:      parsed.data.fileType,
        isShared:      parsed.data.isShared,
      },
    })

    return created({ id: record.id })
  } catch (err) {
    console.error('[POST /api/medical-records]', err)
    return serverError()
  }
}
