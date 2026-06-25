import { prisma } from '@/lib/prisma'
import type { Prisma, AppointmentStatus } from '@prisma/client'

export async function getAffiliatedDoctorIds(facilityId: string): Promise<string[]> {
  const rows = await prisma.doctorFacility.findMany({
    where: { facilityId, isActive: true },
    select: { doctorId: true },
  })
  return rows.map((r) => r.doctorId)
}

export async function buildFacilityAppointmentWhere(
  facilityId: string,
  filters?: {
    doctorId?: string | null
    status?: string | null
    fromDate?: string | null
    toDate?: string | null
  },
): Promise<Prisma.AppointmentWhereInput> {
  const doctorIds = await getAffiliatedDoctorIds(facilityId)

  const scope: Prisma.AppointmentWhereInput[] = [{ facilityId }]
  if (doctorIds.length > 0) {
    scope.push({ doctorId: { in: doctorIds } })
  }

  const where: Prisma.AppointmentWhereInput = {
    deletedAt: null,
    OR: scope,
  }

  if (filters?.doctorId) where.doctorId = filters.doctorId
  if (filters?.status) where.status = filters.status as AppointmentStatus

  if (filters?.fromDate || filters?.toDate) {
    where.scheduledAt = {}
    if (filters.fromDate) where.scheduledAt.gte = new Date(filters.fromDate)
    if (filters.toDate) {
      const end = new Date(filters.toDate)
      end.setHours(23, 59, 59, 999)
      where.scheduledAt.lte = end
    }
  }

  return where
}

export async function canFacilityManageAppointment(
  facilityId: string,
  appointment: { facilityId: string | null; doctorId: string | null },
): Promise<boolean> {
  if (appointment.facilityId === facilityId) return true
  if (!appointment.doctorId) return false

  const link = await prisma.doctorFacility.findFirst({
    where: { facilityId, doctorId: appointment.doctorId, isActive: true },
    select: { id: true },
  })
  return !!link
}
