// src/app/api/onboarding/doctor/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, db } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import {
  createPendingAiVerificationSession,
  logVerificationPhase,
  VerificationPipelinePhase,
} from '@/lib/verification/lifecycle'
import { ApprovalStatus } from '@prisma/client'
import { z } from 'zod'

const CredentialSchema = z.object({
  title:       z.string().min(2),
  institution: z.string().min(2),
  country:     z.string().default('SA'),
  year:        z.coerce.number().min(1970).max(new Date().getFullYear()),
  level:       z.string().default('BACHELOR'),
})

const Schema = z.object({
  firstName:         z.string().min(2),
  lastName:          z.string().optional(),
  phone:             z.string().min(9),
  gender:            z.enum(['MALE', 'FEMALE']),
  specialization:    z.string().min(2),
  subSpecialization: z.string().optional(),
  licenseNumber:     z.string().min(3),
  yearsOfExperience: z.number().min(0).max(60).optional(),
  consultationFee:   z.number().positive().optional(),
  city:              z.string().optional(),
  bio:               z.string().optional(),
  credentials:       z.array(CredentialSchema).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return ok({ error: true, message: 'غير مصرح' })

    const body   = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      console.error('[onboarding/doctor] validation error:', parsed.error.flatten())
      return ok({ error: true, message: 'بيانات غير صحيحة: ' + parsed.error.issues[0]?.message })
    }

    const data   = parsed.data
    const userId = session.user.id

    // تحقق أن licenseNumber غير مستخدم
    const existingLicense = await prisma.doctorProfile.findFirst({
      where: { licenseNumber: data.licenseNumber, userId: { not: userId } },
      select: { id: true },
    })
    if (existingLicense) return ok({ error: true, message: 'رقم الترخيص مستخدم مسبقاً' })

    // إنشاء أو تحديث الملف
    const doctor = await prisma.doctorProfile.upsert({
      where: { userId },
      update: {
        firstName:         data.firstName,
        lastName:          data.lastName ?? '',
        phone:             data.phone,
        gender:            data.gender,
        specialization:    data.specialization,
        subSpecialization: data.subSpecialization,
        licenseNumber:     data.licenseNumber,
        licenseImageUrl:   '',
        yearsOfExperience: data.yearsOfExperience ?? 0,
        consultationFee:   data.consultationFee,
        city:              data.city,
        bio:               data.bio,
        approvalStatus:    ApprovalStatus.PENDING,
      },
      create: {
        userId,
        firstName:         data.firstName,
        lastName:          data.lastName ?? '',
        phone:             data.phone,
        gender:            data.gender,
        specialization:    data.specialization,
        subSpecialization: data.subSpecialization,
        licenseNumber:     data.licenseNumber,
        licenseImageUrl:   '',
        yearsOfExperience: data.yearsOfExperience ?? 0,
        consultationFee:   data.consultationFee,
        city:              data.city,
        bio:               data.bio,
        approvalStatus:    ApprovalStatus.PENDING,
        languages:         ['ar'],
        country:           'SA',
      },
    })

    // حفظ الشهادات
    if (data.credentials && data.credentials.length > 0) {
      // حذف القديم وإنشاء الجديد
      await prisma.doctorCredential.deleteMany({ where: { doctorId: doctor.id } })
      await prisma.doctorCredential.createMany({
        data: data.credentials.map(c => ({
          doctorId:    doctor.id,
          title:       c.title,
          institution: c.institution,
          country:     c.country,
          year:        c.year,
          documentUrl: '',
        })),
      })
    }

    // ── جلسة تحقق v2: PENDING_AI فور التسجيل (مسار /api/doctor/verification-status)
    const { sessionId, created } = await createPendingAiVerificationSession(doctor.id, userId)
    if (created) {
      logVerificationPhase(VerificationPipelinePhase.PENDING_AI, {
        doctorId:  doctor.id,
        sessionId,
        userId,
        source:    'onboarding/doctor',
      })
    }

    // سجل قديم للتوافق مع لوحات تعتمد على doctor_verifications
    const hasDv = await db.doctorVerification.findUnique({ where: { doctorId: doctor.id } }).catch(() => null)
    if (!hasDv) {
      await db.doctorVerification.create({
        data: {
          doctorId: doctor.id,
          verificationStatus: 'PENDING',
          currentStage:       'UPLOAD_CERTIFICATE',
        },
      })
    }

    return ok({ message: 'تم إرسال طلبك بنجاح، في انتظار المراجعة' })
  } catch (err) {
    console.error('[POST /api/onboarding/doctor]', err)
    return serverError()
  }
}
