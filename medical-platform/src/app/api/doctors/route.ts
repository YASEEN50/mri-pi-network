// =============================================================================
// src/app/api/doctors/route.ts
// GET /api/doctors  — بحث وفلترة
// POST /api/doctors — تسجيل طبيب جديد (مع رفع ملفات multipart)
// =============================================================================

import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { container } from '@/infrastructure'
import { requireAuth } from '@/infrastructure/auth/providers/email-auth.provider'
import { ok, created, fromAppError, parseQuery, serverError } from '@/lib/api-response'
import { DoctorSearchSchema, RegisterDoctorSchema } from '@/lib/validations/doctor.schema'
import { AppError } from '@/core/errors'

// ---------------------------------------------------------------------------
// GET /api/doctors
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const parsed = parseQuery(DoctorSearchSchema, req.nextUrl.searchParams)
    if (!parsed.success) return parsed.response

    const { page, limit, ...filters } = parsed.data
    const result = await container.doctorRepo.search({
      ...filters,
      page,
      limit,
    })

    return ok(
      result.doctors.map((d) => ({
        id: d.id,
        fullName: d.fullName,
        specialization: d.specialization,
        subSpecialization: d.subSpecialization,
        yearsOfExperience: d.yearsOfExperience,
        city: d.city,
        country: d.country,
        consultationFee: d.consultationFee,
        averageRating: d.averageRating,
        totalReviews: d.totalReviews,
      })),
      { total: result.total, page, limit }
    )
  } catch (err) {
    console.error('[GET /api/doctors]', err)
    return serverError()
  }
}

// ---------------------------------------------------------------------------
// POST /api/doctors — multipart/form-data (ملفات + JSON)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    // حماية: يجب أن يكون المستخدم مسجلاً بدور DOCTOR
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const formData = await req.formData()

    // استخراج JSON من الـ form
    const jsonStr = formData.get('data') as string
    if (!jsonStr) return fromAppError({ code: 'MISSING_DATA', message: 'بيانات JSON مطلوبة', statusCode: 400 } as any)

    const parsed = RegisterDoctorSchema.safeParse(JSON.parse(jsonStr))
    if (!parsed.success) {
      const { fromZodError } = await import('@/lib/api-response')
      return fromZodError(parsed.error)
    }

    // استخراج ملف الرخصة
    const licenseFile = formData.get('licenseFile') as File | null
    if (!licenseFile) return fromAppError({ code: 'MISSING_LICENSE', message: 'ملف الرخصة مطلوب', statusCode: 400 } as any)

    const licenseBuffer = Buffer.from(await licenseFile.arrayBuffer())
    const licenseMime = licenseFile.type as 'image/jpeg' | 'image/png' | 'application/pdf'

    // استخراج ملفات الشهادات
    const credentials = await Promise.all(
      parsed.data.credentials.map(async (cred, i) => {
        const file = formData.get(`credential_${i}`) as File | null
        if (!file) throw new Error(`ملف الشهادة ${i + 1} مطلوب`)
        return {
          ...cred,
          file: Buffer.from(await file.arrayBuffer()),
          fileMime: file.type as 'image/jpeg' | 'image/png' | 'application/pdf',
        }
      })
    )

    const result = await container.registerDoctor.execute({
      userId: auth.context.userId,
      ...parsed.data,
      licenseFile: licenseBuffer,
      licenseFileMime: licenseMime,
      licenseExpiryDate: parsed.data.licenseExpiryDate ? new Date(parsed.data.licenseExpiryDate) : undefined,
      credentials,
    })

    if (!result.success) return fromAppError(result.error)

    return created({
      id: result.data.id,
      fullName: result.data.fullName,
      approvalStatus: result.data.approvalStatus,
      message: 'تم تقديم طلب التسجيل بنجاح، سيتم مراجعة مستنداتك قريباً',
    })
  } catch (err) {
    console.error('[POST /api/doctors]', err)
    if (err instanceof AppError) return fromAppError(err)
    return serverError()
  }
}
