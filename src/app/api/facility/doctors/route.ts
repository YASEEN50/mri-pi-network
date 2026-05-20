// src/app/api/facility/doctors/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma } from '@/lib/prisma'
import { ok, created, fromAppError, serverError } from '@/lib/api-response'
import { Role, ApprovalStatus } from '@prisma/client'
import { z } from 'zod'

const LinkDoctorSchema = z.object({
  doctorId: z.string().uuid(),
  role:     z.string().max(100).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.FACILITY] })
    if (!auth.success) return fromAppError(auth.error)

    const facilityProfile = await prisma.facilityProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { id: true },
    })

    if (!facilityProfile) return ok([])

    const doctors = await prisma.doctorFacility.findMany({
      where: { facilityId: facilityProfile.id },
      include: {
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialization: true,
            averageRating: true,
            totalReviews: true,
            avatarUrl: true,
            approvalStatus: true,
          },
        },
      },
    })

    return ok(doctors.map((d: any) => ({
      doctorId: d.doctorId,
      role: d.role,
      isActive: d.isActive,
      doctor: {
        firstName: d.doctor.firstName,
        lastName: d.doctor.lastName,
        specialization: d.doctor.specialization,
        averageRating: Number(d.doctor.averageRating),
        totalReviews: d.doctor.totalReviews,
        avatarUrl: d.doctor.avatarUrl,
        approvalStatus: d.doctor.approvalStatus,
      },
    })))
  } catch (err) {
    console.error('[GET /api/facility/doctors]', err)
    return serverError()
  }
}

/** ربط طبيب معتمد بمنشأة المنشأة الحالية */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.FACILITY] })
    if (!auth.success) return fromAppError(auth.error)

    const body   = await req.json()
    const parsed = LinkDoctorSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const facility = await prisma.facilityProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { id: true },
    })
    if (!facility) return ok({ error: true, message: 'ملف المنشأة غير موجود' })

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: parsed.data.doctorId },
      select: { id: true, approvalStatus: true },
    })
    if (!doctor) return ok({ error: true, message: 'الطبيب غير موجود' })
    if (doctor.approvalStatus !== ApprovalStatus.APPROVED) {
      return ok({ error: true, message: 'يمكن ربط الأطباء المعتمدين فقط' })
    }

    const link = await prisma.doctorFacility.upsert({
      where: {
        doctorId_facilityId: { doctorId: doctor.id, facilityId: facility.id },
      },
      create: {
        doctorId:   doctor.id,
        facilityId: facility.id,
        role:       parsed.data.role,
        isActive:   true,
      },
      update: {
        role:     parsed.data.role,
        isActive: true,
      },
    })

    console.log('[facility/doctors] doctor linked', {
      facilityId: facility.id,
      doctorId:   doctor.id,
      linkId:     link.id,
    })

    return created({ doctorId: doctor.id, facilityId: facility.id, role: link.role })
  } catch (err) {
    console.error('[POST /api/facility/doctors]', err)
    return serverError()
  }
}
