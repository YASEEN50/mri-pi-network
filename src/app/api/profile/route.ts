// src/app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const ProfileSchema = z.object({
  firstName:        z.string().max(50).optional(),
  lastName:         z.string().max(50).optional(),
  avatarUrl: z
    .union([z.string().url(), z.string().regex(/^\/api\/avatars\//), z.literal('')])
    .optional(),
  bio:              z.string().max(500).optional(),
  city:             z.string().max(100).optional(),
  phone:            z.string().max(20).optional(),
  gender:           z.enum(['MALE', 'FEMALE']).optional(),
  dateOfBirth:      z.string().optional(),
  bloodType:        z.string().optional(),
  allergies:        z.array(z.string()).optional(),
  chronicDiseases:  z.array(z.string()).optional(),
  healthStatus:     z.string().optional(),
  yearsOfExperience: z.number().min(0).max(60).optional(),
})

// GET - جلب الملف الشخصي
export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const { userId, role } = auth.context

    if (role === Role.CLIENT) {
      const profile = await prisma.clientProfile.findUnique({
        where: { userId },
      })
      if (!profile) return ok(null)
      return ok({
        firstName:       profile.firstName,
        lastName:        profile.lastName,
        avatarUrl:       profile.avatarUrl,
        piCreditBalance: Number(profile.piCreditBalance),
        phone:           (profile as any).phone,
        city:            profile.city,
        gender:          profile.gender,
        dateOfBirth:     profile.dateOfBirth?.toISOString(),
        bloodType:       profile.bloodType,
        allergies:       profile.allergies,
        chronicDiseases: profile.chronicDiseases,
        healthStatus:    (profile as any).healthStatus ?? 'UNSPECIFIED',
      })
    }

    if (role === Role.DOCTOR) {
      const profile = await prisma.doctorProfile.findUnique({
        where: { userId },
      })
      if (!profile) return ok(null)
      return ok({
        id:                profile.id,
        firstName:         profile.firstName,
        lastName:          profile.lastName,
        avatarUrl:         profile.avatarUrl,
        bio:               profile.bio,
        phone:             (profile as any).phone,
        city:              profile.city,
        gender:            profile.gender,
        specialization:    profile.specialization,
        yearsOfExperience: profile.yearsOfExperience,
      })
    }

    return ok(null)
  } catch (err) {
    console.error('[GET /api/profile]', err)
    return serverError()
  }
}

// POST - تحديث الملف الشخصي
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = ProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة' } },
        { status: 400 },
      )
    }

    const { userId, role } = auth.context
    const data = parsed.data

    if (role === Role.CLIENT) {
      await prisma.clientProfile.upsert({
        where: { userId },
        update: {
          ...(data.firstName       && { firstName: data.firstName }),
          ...(data.lastName        && { lastName: data.lastName }),
          ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl || null }),
          ...(data.phone           && { phone: data.phone }),
          ...(data.city            && { city: data.city }),
          ...(data.gender          && { gender: data.gender }),
          ...(data.bloodType       && { bloodType: data.bloodType }),
          ...(data.allergies       && { allergies: data.allergies }),
          ...(data.chronicDiseases && { chronicDiseases: data.chronicDiseases }),
        },
        create: {
          userId,
          firstName:       data.firstName ?? 'مستخدم',
          lastName:        data.lastName ?? '',
          phone:           data.phone,
          city:            data.city,
          gender:          data.gender,
          bloodType:       data.bloodType,
          allergies:       data.allergies ?? [],
          chronicDiseases: data.chronicDiseases ?? [],
          country:         'SA',
        },
      })
      return ok({ message: 'تم تحديث الملف الشخصي' })
    }

    if (role === Role.DOCTOR) {
      const profile = await prisma.doctorProfile.findUnique({ where: { userId } })
      if (!profile) return ok({ error: true, message: 'الملف الشخصي غير موجود' })

      await prisma.doctorProfile.update({
        where: { userId },
        data: {
          ...(data.firstName         && { firstName: data.firstName }),
          ...(data.lastName          && { lastName: data.lastName }),
          ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl || null }),
          ...(data.bio               && { bio: data.bio }),
          ...(data.phone             && { phone: data.phone }),
          ...(data.city              && { city: data.city }),
          ...(data.gender            && { gender: data.gender }),
          ...(data.yearsOfExperience !== undefined && { yearsOfExperience: data.yearsOfExperience }),
        },
      })
      return ok({ message: 'تم تحديث الملف الشخصي' })
    }

    return ok({ error: true, message: 'غير مدعوم لهذا النوع من الحسابات' })
  } catch (err) {
    console.error('[POST /api/profile]', err)
    return serverError()
  }
}