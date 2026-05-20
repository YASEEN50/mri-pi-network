import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { NotFoundError } from '@/core/errors'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const doctor = await prisma.doctorProfile.findFirst({
      where: { id, deletedAt: null },
      include: {
        credentials: true,
        availability: { where: { isActive: true }, orderBy: { dayOfWeek: 'asc' } },
      },
    })
    if (!doctor) return fromAppError(new NotFoundError(`الطبيب بالمعرف ${id} غير موجود`))

    return ok({
      id: doctor.id,
      fullName: `${doctor.firstName} ${doctor.lastName}`,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      specialization: doctor.specialization,
      yearsOfExperience: doctor.yearsOfExperience,
      city: doctor.city,
      country: doctor.country,
      consultationFee: doctor.consultationFee ? Number(doctor.consultationFee) : null,
      averageRating: Number(doctor.averageRating),
      totalReviews: doctor.totalReviews,
      licenseNumber: doctor.licenseNumber,
      licenseImageUrl: doctor.licenseImageUrl,
      approvalStatus: doctor.approvalStatus,
      bio: doctor.bio,
      languages: doctor.languages,
      phone: (doctor as any).phone,
      gender: doctor.gender,
      availabilities: doctor.availability?.map((a) => ({
        day:         a.dayOfWeek,
        startTime:   a.startTime,
        endTime:     a.endTime,
        slotMinutes: a.slotMinutes,
      })) ?? [],
      credentials: doctor.credentials.map((c) => ({
        id: c.id,
        title: c.title,
        institution: c.institution,
        country: c.country,
        year: c.year,
        documentUrl: c.documentUrl,
        isVerified: c.isVerified,
      })),
    })
  } catch (err) {
    console.error('[GET /api/doctors/[id]]', err)
    return serverError()
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const { firstName, lastName, specialization, yearsOfExperience, city, consultationFee, bio } = body

    const updated = await prisma.doctorProfile.update({
      where: { id },
      data: { firstName, lastName, specialization, yearsOfExperience, city, consultationFee, bio, updatedAt: new Date() },
      select: { id: true, firstName: true, lastName: true, specialization: true },
    })

    return ok(updated)
  } catch (err) {
    console.error('[PUT /api/doctors/[id]]', err)
    return serverError()
  }
}
