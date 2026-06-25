// src/app/api/appointments/route.ts
import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { createRemindersForAppointment } from '@/lib/cron/reminders.service'
import { doctorHasActivePremioByProfileId } from '@/lib/premio/active-premio'
import { appointmentVideoFields } from '@/lib/appointments/online-video'
import { assertBookableSlot } from '@/lib/appointments/booking'
import { notifyAppointmentBooked } from '@/lib/appointments/notifications'
import { isOnlineBookingEnabled } from '@/lib/appointments/online-video'
import { buildFacilityAppointmentWhere } from '@/lib/facility/appointment-scope'

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
    const doctorId = req.nextUrl.searchParams.get('doctorId')
    const fromDate = req.nextUrl.searchParams.get('fromDate')
    const toDate = req.nextUrl.searchParams.get('toDate')
    const skip   = (page - 1) * limit

    let where: any = { deletedAt: null }
    if (role === Role.CLIENT)   where.clientId  = userId
    if (role === Role.DOCTOR) {
      const doctor = await prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true } })
      if (doctor) where.doctorId = doctor.id
    }
    if (role === Role.FACILITY) {
      const facility = await prisma.facilityProfile.findUnique({ where: { userId }, select: { id: true } })
      if (facility) {
        where = await buildFacilityAppointmentWhere(facility.id, {
          doctorId,
          status,
          fromDate,
          toDate,
        })
      }
    } else {
      if (status) where.status = status
      if (fromDate || toDate) {
        where.scheduledAt = {}
        if (fromDate) where.scheduledAt.gte = new Date(fromDate)
        if (toDate) {
          const end = new Date(toDate)
          end.setHours(23, 59, 59, 999)
          where.scheduledAt.lte = end
        }
      }
    }

    const [appointments, total] = await prisma.$transaction([
      prisma.appointment.findMany({
        where, skip, take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          doctor:   { select: { id: true, firstName: true, lastName: true, specialization: true, avatarUrl: true, paymentPolicy: true, depositPercentage: true } },
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
        paymentPolicy: a.doctor?.paymentPolicy ?? 'PAY_ON_SERVICE',
        depositPercentage: a.doctor ? Number(a.doctor.depositPercentage) : 0,
        createdAt:    a.createdAt,
        doctorId:     a.doctorId,
        facilityId:   a.facilityId,
        clientId:     a.clientId,
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
        ...appointmentVideoFields({
          id: a.id,
          type: a.type,
          status: a.status,
          scheduledAt: a.scheduledAt,
          duration: a.duration,
        }),
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

    if (type === 'ONLINE' && !isOnlineBookingEnabled()) {
      return ok({ error: true, message: 'الاستشارات عن بعد غير متاحة حالياً — يرجى اختيار موعد حضوري' })
    }

    if (!doctorId && !facilityId) {
      return ok({ error: true, message: 'يجب تحديد طبيب أو منشأة' })
    }

    const scheduledDate = new Date(scheduledAt)

    let resolvedFee = fee

    let doctorPayment: { paymentPolicy: string; depositPercentage: unknown } | null = null

    if (doctorId) {
      const doctor = await prisma.doctorProfile.findFirst({
        where: { id: doctorId, deletedAt: null, approvalStatus: 'APPROVED' },
        select: { id: true, consultationFee: true, paymentPolicy: true, depositPercentage: true },
      })
      if (!doctor) return ok({ error: true, message: 'الطبيب غير متاح للحجز' })

      doctorPayment = { paymentPolicy: doctor.paymentPolicy, depositPercentage: doctor.depositPercentage }

      const listed = await doctorHasActivePremioByProfileId(doctorId)
      if (!listed) return ok({ error: true, message: 'هذا الطبيب غير متاح للحجز حالياً' })

      if (resolvedFee == null && doctor.consultationFee != null) {
        resolvedFee = Number(doctor.consultationFee)
      }
    }

    if (facilityId) {
      const facility = await prisma.facilityProfile.findFirst({
        where: { id: facilityId, deletedAt: null, approvalStatus: 'APPROVED' },
        select: { id: true },
      })
      if (!facility) return ok({ error: true, message: 'المنشأة غير متاحة للحجز' })
    }

    const slotCheck = await assertBookableSlot({
      scheduledAt: scheduledDate,
      duration,
      doctorId,
      facilityId,
    })
    if (!slotCheck.ok) return ok({ error: true, message: slotCheck.message })

    const appointment = await prisma.appointment.create({
      data: {
        clientId:    auth.context.userId,
        doctorId,
        facilityId,
        type,
        scheduledAt: scheduledDate,
        duration,
        reason,
        notes,
        fee:         resolvedFee,
      },
    })

    createRemindersForAppointment(appointment.id).catch(console.error)
    notifyAppointmentBooked(appointment.id).catch(console.error)

    return created({
      id: appointment.id,
      status: appointment.status,
      fee: resolvedFee ?? null,
      ...(doctorPayment && {
        paymentPolicy: doctorPayment.paymentPolicy,
        depositPercentage: Number(doctorPayment.depositPercentage),
      }),
    })
  } catch (err) {
    console.error('[POST /api/appointments]', err)
    return serverError()
  }
}
