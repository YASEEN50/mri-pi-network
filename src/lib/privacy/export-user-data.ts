import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { medicalRecordFileUrl } from '@/lib/medical-records/storage'

export interface UserDataExport {
  exportedAt: string
  platform: 'MRI Medical Platform'
  format: 'GDPR Article 20 — portable JSON'
  userId: string
  account: Record<string, unknown>
  profiles: Record<string, unknown>
  appointments: unknown[]
  reviews: unknown[]
  notifications: unknown[]
  transactions: unknown[]
  premios: unknown[]
  medicalRecords: unknown[]
  chatRooms: unknown[]
  referrals: unknown[]
  publications: unknown[]
}

export async function buildUserDataExport(userId: string, role: Role): Promise<UserDataExport> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      phone: true,
      role: true,
      isActive: true,
      piUid: true,
      piUsername: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) throw new Error('USER_NOT_FOUND')

  const profiles: Record<string, unknown> = {}

  const clientProfile = await prisma.clientProfile.findUnique({
    where: { userId },
  })
  if (clientProfile) profiles.client = clientProfile

  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { userId },
    include: {
      credentials: true,
      availability: true,
      facilities: { include: { facility: { select: { id: true, name: true, city: true } } } },
    },
  })
  if (doctorProfile) profiles.doctor = doctorProfile

  const facilityProfile = await prisma.facilityProfile.findUnique({
    where: { userId },
  })
  if (facilityProfile) profiles.facility = facilityProfile

  const adminProfile = await prisma.adminProfile.findUnique({
    where: { userId },
  })
  if (adminProfile) profiles.admin = adminProfile

  const appointments = await prisma.appointment.findMany({
    where: {
      OR: [
        { clientId: userId },
        ...(doctorProfile ? [{ doctorId: doctorProfile.id }] : []),
        ...(facilityProfile ? [{ facilityId: facilityProfile.id }] : []),
      ],
    },
    orderBy: { scheduledAt: 'desc' },
  })

  const reviews = await prisma.review.findMany({
    where: { clientId: userId },
    orderBy: { createdAt: 'desc' },
  })

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  const premios = await prisma.premio.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  let medicalRecords: unknown[] = []
  if (clientProfile) {
    const records = await prisma.medicalRecord.findMany({
      where: { clientId: clientProfile.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    medicalRecords = records.map(r => ({
      ...r,
      fileDownloadPath: r.fileUrl ? medicalRecordFileUrl(r.id) : null,
      note: 'Use authenticated GET on fileDownloadPath to download attachments before account deletion.',
    }))
  }

  const chatRooms = await prisma.chatRoom.findMany({
    where: {
      OR: [
        { clientId: userId },
        ...(doctorProfile ? [{ doctorId: doctorProfile.id }] : []),
      ],
    },
    include: {
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  let referrals: unknown[] = []
  let publications: unknown[] = []
  if (doctorProfile) {
    referrals = await prisma.referral.findMany({
      where: {
        OR: [{ fromDoctorId: doctorProfile.id }, { toDoctorId: doctorProfile.id }],
      },
      orderBy: { createdAt: 'desc' },
    })
    publications = await prisma.publication.findMany({
      where: { doctorId: doctorProfile.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
  }

  return {
    exportedAt: new Date().toISOString(),
    platform: 'MRI Medical Platform',
    format: 'GDPR Article 20 — portable JSON',
    userId: user.id,
    account: user,
    profiles,
    appointments,
    reviews,
    notifications,
    transactions,
    premios,
    medicalRecords,
    chatRooms,
    referrals,
    publications,
  }
}
