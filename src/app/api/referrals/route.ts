import { NextRequest } from 'next/server'
import { Role, ApprovalStatus, ReferralStatus } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { serializeReferrals } from '@/lib/referrals/serialize'
import { notifyReferralCreated } from '@/lib/referrals/notifications'

const CreateSchema = z.object({
  toDoctorId: z.string().uuid(),
  clientId: z.string().uuid(),
  reason: z.string().min(5).max(500),
  notes: z.string().max(1000).optional(),
  appointmentId: z.string().uuid().optional(),
})

async function getDoctorProfile(userId: string) {
  return prisma.doctorProfile.findUnique({
    where: { userId },
    select: { id: true, approvalStatus: true },
  })
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const doctor = await getDoctorProfile(auth.context.userId)
    if (!doctor) return ok({ error: true, message: 'ملف الطبيب غير موجود' })

    const direction = req.nextUrl.searchParams.get('direction') ?? 'all'
    const statusParam = req.nextUrl.searchParams.get('status')

    const where: {
      OR?: Array<{ fromDoctorId: string } | { toDoctorId: string }>
      fromDoctorId?: string
      toDoctorId?: string
      status?: ReferralStatus
    } = {}

    if (direction === 'sent') where.fromDoctorId = doctor.id
    else if (direction === 'received') where.toDoctorId = doctor.id
    else where.OR = [{ fromDoctorId: doctor.id }, { toDoctorId: doctor.id }]

    if (statusParam) where.status = statusParam as ReferralStatus

    const referrals = await prisma.referral.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        fromDoctor: { select: { id: true, firstName: true, lastName: true, specialization: true, userId: true } },
        toDoctor: { select: { id: true, firstName: true, lastName: true, specialization: true, userId: true } },
      },
    })

    return ok(await serializeReferrals(referrals))
  } catch (err) {
    console.error('[GET /api/referrals]', err)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR], requireApproved: true })
    if (!auth.success) return fromAppError(auth.error)

    const doctor = await getDoctorProfile(auth.context.userId)
    if (!doctor || doctor.approvalStatus !== ApprovalStatus.APPROVED) {
      return ok({ error: true, message: 'يجب أن يكون حسابك معتمداً لإرسال إحالات' })
    }

    const body = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { toDoctorId, clientId, reason, notes, appointmentId } = parsed.data

    if (toDoctorId === doctor.id) {
      return ok({ error: true, message: 'لا يمكنك الإحالة إلى نفسك' })
    }

    const toDoctor = await prisma.doctorProfile.findFirst({
      where: { id: toDoctorId, approvalStatus: ApprovalStatus.APPROVED, deletedAt: null },
      select: { id: true },
    })
    if (!toDoctor) return ok({ error: true, message: 'الطبيب المستهدف غير متاح' })

    const hasClientRelation = await prisma.appointment.findFirst({
      where: {
        clientId,
        doctorId: doctor.id,
        deletedAt: null,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      select: { id: true },
    })
    if (!hasClientRelation) {
      return ok({ error: true, message: 'يمكنك إحالة مرضى لديك موعد مؤكد أو مكتمل معهم فقط' })
    }

    const duplicate = await prisma.referral.findFirst({
      where: {
        fromDoctorId: doctor.id,
        toDoctorId,
        clientId,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
    })
    if (duplicate) return ok({ error: true, message: 'توجد إحالة نشطة لهذا المريض مع نفس الطبيب' })

    const referral = await prisma.referral.create({
      data: {
        fromDoctorId: doctor.id,
        toDoctorId,
        clientId,
        reason,
        notes,
        appointmentId,
      },
      include: {
        fromDoctor: { select: { id: true, firstName: true, lastName: true, specialization: true, userId: true } },
        toDoctor: { select: { id: true, firstName: true, lastName: true, specialization: true, userId: true } },
      },
    })

    notifyReferralCreated(referral.id).catch(console.error)

    const [serialized] = await serializeReferrals([referral])
    return created(serialized)
  } catch (err) {
    console.error('[POST /api/referrals]', err)
    return serverError()
  }
}
