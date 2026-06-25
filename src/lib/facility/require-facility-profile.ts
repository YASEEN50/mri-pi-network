import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { UnauthorizedError } from '@/core/errors'
import { requireAuth, type AuthSuccess, type AuthFailure } from '@/infrastructure/auth/providers/role-guard'
import { fromAppError } from '@/lib/api-response'

export async function requireFacilityProfile(): Promise<
  | (AuthSuccess & { facilityId: string })
  | AuthFailure
> {
  const auth = await requireAuth({ roles: [Role.FACILITY] })
  if (!auth.success) return auth

  const facility = await prisma.facilityProfile.findUnique({
    where: { userId: auth.context.userId },
    select: { id: true },
  })

  if (!facility) {
    return { success: false, error: new UnauthorizedError('ملف المنشأة غير موجود — أكمل التسجيل') }
  }

  return { ...auth, facilityId: facility.id }
}

export async function requireFacilityProfileResponse() {
  const auth = await requireFacilityProfile()
  if (!auth.success) return { error: fromAppError(auth.error) }
  return { facilityId: auth.facilityId }
}

export async function isDoctorInFacility(facilityId: string, doctorId: string): Promise<boolean> {
  const link = await prisma.doctorFacility.findFirst({
    where: { facilityId, doctorId, isActive: true },
    select: { id: true },
  })
  return !!link
}

export async function isDoctorAssignedToDepartment(
  departmentId: string,
  doctorId: string,
): Promise<boolean> {
  const assignment = await prisma.departmentDoctorAssignment.findFirst({
    where: { departmentId, doctorId, isActive: true },
    select: { id: true },
  })
  return !!assignment
}

export async function requireDepartmentInFacility(facilityId: string, departmentId: string) {
  return prisma.facilityDepartment.findFirst({
    where: { id: departmentId, facilityId },
    select: { id: true, name: true, isActive: true },
  })
}
