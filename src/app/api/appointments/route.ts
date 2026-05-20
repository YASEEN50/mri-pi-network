// src/app/api/appointments/route.ts
import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { createRemindersForAppointment, cancelRemindersForAppointment } from '@/lib/cron/reminders.service'

const CreateSchema = z.object({
  doctorId:    z.string().uuid().optional(),
  facilityId:  z.string().uuid().optional(),
  type:        z.enum(['IN_PERSON', 'ONLINE']),
  scheduledAt: z.string().datetime(),
  duration:    z.number().min(15).max(240),
  reason:      z.string().max(500).optional(),
  notes:       z.string().max(1000).optional(),
  fee:         z.number().positive().optional(),
})

// GET — جلب المواعيد حسب الدور
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { userId, role } = auth.context
    const page   = Number(req.nextUrl.searchParams.get('page')  ?? 1)
    const limit  = Number(req.nextUrl.searchParams.get('limit') ?? 20)
    const status = req.nextUrl.searchParams.get('status')
    const skip   = (page - 1) * limit

    const where: any = { deletedAt: null }
    if (role === Role.CLIENT)   where.clientId  = userId
    if (role === Role.DOCTOR) {
      const doctor = await prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true } })
      if (doctor) where.doctorId = doctor.id
    }
    if (role === Role.FACILITY) {
      const facility = await prisma.facilityProfile.findUnique({ where: { userId }, select: { id: true } })
      if (facility) where.facilityId = facility.id
    }
    if (status) where.status = status

    const [appointments, total] = await prisma.$transaction([
      prisma.appointment.findMany({
        where, skip, take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          doctor:   { select: { id: true, firstName: true, lastName: true, specialization: true, avatarUrl: true } },
          facility: { select: { id: true, name: true, type: true } },
          client:   { select: { id: true, email: true } },
          review:   { select: { id: true, rating: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ])

    return ok(
      appointments.map((a: any) => ({
        id:           a.id,
        status:       a.status,
        type:         a.type,
        scheduledAt:  a.scheduledAt,
        duration:     a.duration,
        reason:       a.reason,
        notes:        a.notes,
        doctorNotes:  a.doctorNotes,
        cancelReason: a.cancelReason,
        fee:          a.fee ? Number(a.fee) : null,
        depositAmount: a.depositAmount ? Number(a.depositAmount) : null,
        isPaid:       a.isPaid,
        isDepositPaid: a.isDepositPaid,
        createdAt:    a.createdAt,
        // معرّفات
        doctorId:     a.doctorId,
        facilityId:   a.facilityId,
        clientId:     a.clientId,
        // بيانات مُضمَّنة
        doctor:       a.doctor ? `د. ${a.doctor.firstName} ${a.doctor.lastName}` : null,
        doctorDetails: a.doctor ? {
          id:             a.doctor.id,
          specialization: a.doctor.specialization,
          avatarUrl:      a.doctor.avatarUrl,
        } : null,
        facility:     a.facility?.name ?? null,
        clientName:   a.client?.email ?? null,
        hasReview:    !!a.review,
        reviewRating: a.review?.rating ?? null,
      })),
      { total, page, limit }
    )
  } catch (err) {
    console.error('[GET /api/appointments]', err)
    return serverError()
  }
}

// POST — إنشاء موعد جديد
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.CLIENT] })
    if (!auth.success) return fromAppError(auth.error)

    const body   = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { doctorId, facilityId, type, scheduledAt, duration, reason, notes, fee } = parsed.data

    if (!doctorId && !facilityId) {
      return ok({ error: true, message: 'يجب تحديد طبيب أو منشأة' })
    }

    const appointment = await prisma.appointment.create({
      data: {
        clientId:    auth.context.userId,
        doctorId,
        facilityId,
        type,
        scheduledAt: new Date(scheduledAt),
        duration,
        reason,
        notes,
        fee,
      },
    })

        // إنشاء تذكيرات تلقائية
    createRemindersForAppointment(appointment.id).catch(console.error)

    return created({ id: appointment.id, status: appointment.status })
  } catch (err) {
    console.error('[POST /api/appointments]', err)
    return serverError()
  }
}
