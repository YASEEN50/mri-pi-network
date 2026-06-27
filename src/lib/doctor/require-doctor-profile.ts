import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { UnauthorizedError } from '@/core/errors'
import { requireAuth, type AuthSuccess, type AuthFailure } from '@/infrastructure/auth/providers/role-guard'

export const DOCTOR_PROFILE_MISSING_MESSAGE =
  'ملف الطبيب غير موجود — أكمل التسجيل من صفحة تسجيل الطبيب أولاً'

export async function requireDoctorProfile(): Promise<
  | (AuthSuccess & { doctorId: string; firstName: string; lastName: string })
  | AuthFailure
> {
  const auth = await requireAuth({ roles: [Role.DOCTOR] })
  if (!auth.success) return auth

  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId: auth.context.userId },
    select: { id: true, firstName: true, lastName: true },
  })

  if (!doctor) {
    return {
      success: false,
      error: new UnauthorizedError(DOCTOR_PROFILE_MISSING_MESSAGE),
    }
  }

  return {
    ...auth,
    doctorId: doctor.id,
    firstName: doctor.firstName,
    lastName: doctor.lastName,
  }
}
