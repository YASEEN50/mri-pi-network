// =============================================================================
// src/app/api/doctors/[id]/route.ts
// GET /api/doctors/[id]
// PUT /api/doctors/[id]
// =============================================================================

import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { container } from '@/infrastructure'
import { requireAuth } from '@/infrastructure/auth/providers/email-auth.provider'
import { ok, fromAppError, parseBody, serverError } from '@/lib/api-response'
import { UpdateDoctorSchema } from '@/lib/validations/doctor.schema'
import { NotFoundError, ForbiddenError } from '@/core/errors'
import { prisma } from '@/infrastructure/database/prisma/client'

// ---------------------------------------------------------------------------
// GET /api/doctors/[id]
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doctor = await container.doctorRepo.findById(params.id)
    if (!doctor) return fromAppError(new NotFoundError('الطبيب', params.id))

    return ok({
      id: doctor.id,
      fullName: doctor.fullName,
      specialization: doctor.specialization,
      subSpecialization: doctor.subSpecialization,
      yearsOfExperience: doctor.yearsOfExperience,
      city: doctor.city,
      country: doctor.country,
      consultationFee: doctor.consultationFee,
      averageRating: doctor.averageRating,
      totalReviews: doctor.totalReviews,
      totalAppointments: doctor.totalAppointments,
      credentials: doctor.credentials.map((c) => ({
        title: c.title,
        institution: c.institution,
        country: c.country,
        year: c.year,
        level: c.level,
      })),
    })
  } catch (err) {
    console.error('[GET /api/doctors/[id]]', err)
    return serverError()
  }
}

// ---------------------------------------------------------------------------
// PUT /api/doctors/[id]
// ---------------------------------------------------------------------------
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    // التحقق من أن الطبيب يعدّل ملفه فقط
    const doctor = await container.doctorRepo.findByUserId(auth.context.userId)
    if (!doctor || doctor.id !== params.id) {
      return fromAppError(new ForbiddenError('لا يمكنك تعديل ملف طبيب آخر'))
    }

    const body = await req.json()
    const parsed = parseBody(UpdateDoctorSchema, body)
    if (!parsed.success) return parsed.response

    const updated = await prisma.doctorProfile.update({
      where: { id: params.id },
      data: { ...parsed.data, updatedAt: new Date() },
      select: { id: true, firstName: true, lastName: true, specialization: true, updatedAt: true },
    })

    return ok(updated)
  } catch (err) {
    console.error('[PUT /api/doctors/[id]]', err)
    return serverError()
  }
}
