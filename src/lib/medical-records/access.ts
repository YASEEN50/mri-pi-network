// src/lib/medical-records/access.ts

import { Role, AppointmentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface AuthContext {
  userId: string
  role: Role
}

export async function canAccessMedicalRecord(
  auth: AuthContext,
  record: {
    id: string
    clientId: string
    doctorId: string | null
    isShared: boolean
    sharedUntil: Date | null
  }
): Promise<boolean> {
  if (auth.role === Role.ADMIN || auth.role === Role.OWNER) return true

  if (auth.role === Role.CLIENT) {
    const profile = await prisma.clientProfile.findUnique({
      where: { userId: auth.userId },
      select: { id: true },
    })
    return profile?.id === record.clientId
  }

  if (auth.role === Role.DOCTOR) {
    if (!record.isShared) return false
    if (record.sharedUntil && record.sharedUntil < new Date()) return false

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: auth.userId },
      select: { id: true },
    })
    if (!doctor) return false

    if (record.doctorId && record.doctorId !== doctor.id) return false

    const clientProfile = await prisma.clientProfile.findUnique({
      where: { id: record.clientId },
      select: { userId: true },
    })
    if (!clientProfile) return false

    const hasRelationship = await prisma.appointment.findFirst({
      where: {
        doctorId: doctor.id,
        clientId: clientProfile.userId,
        deletedAt: null,
        status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED] },
      },
      select: { id: true },
    })
    return !!hasRelationship
  }

  return false
}

export async function doctorSharedRecordsWhere(userId: string) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!doctor) return null

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      deletedAt: null,
      status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED] },
    },
    select: { clientId: true },
  })

  const userIds = [...new Set(appointments.map((a) => a.clientId))]
  if (userIds.length === 0) return { clientId: { in: [] as string[] } }

  const profiles = await prisma.clientProfile.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  })

  const now = new Date()
  return {
    clientId: { in: profiles.map((p) => p.id) },
    isShared: true,
    OR: [{ sharedUntil: null }, { sharedUntil: { gt: now } }],
  }
}
