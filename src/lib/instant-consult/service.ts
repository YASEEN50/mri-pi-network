import { InstantConsultStatus } from '@prisma/client'
import { prisma, db } from '@/lib/prisma'
import { doctorProfilePublicWhere } from '@/lib/premio/active-premio'
import { INSTANT_CONSULT_ACCEPT_TIMEOUT_SEC } from '@/lib/instant-consult/constants'

export async function expireStaleInstantConsults(): Promise<void> {
  const now = new Date()
  await prisma.instantConsultRequest.updateMany({
    where: {
      status: InstantConsultStatus.PENDING,
      expiresAt: { lte: now },
    },
    data: { status: InstantConsultStatus.EXPIRED },
  })
}

export async function doctorHasActiveInstantSession(doctorId: string): Promise<boolean> {
  const now = new Date()
  const active = await prisma.instantConsultRequest.findFirst({
    where: {
      doctorId,
      OR: [
        { status: InstantConsultStatus.PENDING, expiresAt: { gt: now } },
        { status: InstantConsultStatus.ACCEPTED, sessionEndsAt: { gt: now } },
      ],
    },
    select: { id: true },
  })
  return !!active
}

export async function listAvailableInstantDoctors(specialization?: string | null) {
  await expireStaleInstantConsults()

  const doctors = await prisma.doctorProfile.findMany({
    where: doctorProfilePublicWhere({
      acceptsInstantConsult: true,
      isOnlineForInstant: true,
      instantConsultFee: { not: null, gt: 0 },
      ...(specialization ? { specialization: { contains: specialization, mode: 'insensitive' } } : {}),
    }),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      specialization: true,
      avatarUrl: true,
      averageRating: true,
      totalReviews: true,
      instantConsultFee: true,
      instantConsultDurationMinutes: true,
    },
    orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }],
    take: 50,
  })

  const available = []
  for (const d of doctors) {
    if (!(await doctorHasActiveInstantSession(d.id))) {
      available.push({
        id: d.id,
        fullName: `د. ${d.firstName} ${d.lastName}`,
        specialization: d.specialization,
        avatarUrl: d.avatarUrl,
        averageRating: Number(d.averageRating),
        totalReviews: d.totalReviews,
        fee: Number(d.instantConsultFee),
        durationMinutes: d.instantConsultDurationMinutes,
      })
    }
  }
  return available
}

export function acceptDeadlineFromNow(): Date {
  return new Date(Date.now() + INSTANT_CONSULT_ACCEPT_TIMEOUT_SEC * 1000)
}

export async function createChatRoomForInstantConsult(
  clientProfileId: string,
  doctorId: string,
): Promise<string> {
  const existing = await db.chatRoom.findFirst({
    where: { clientId: clientProfileId, doctorId, status: 'ACTIVE' },
    select: { id: true },
  })
  if (existing) return existing.id

  const room = await db.chatRoom.create({
    data: { clientId: clientProfileId, doctorId, status: 'ACTIVE' },
  })
  return room.id
}

export async function notifyDoctorInstantRequest(doctorUserId: string, requestId: string, clientName: string) {
  await prisma.notification.create({
    data: {
      userId: doctorUserId,
      title: '⚡ طلب استشارة فورية',
      body: `${clientName} يطلب استشارة فورية — لديك ${INSTANT_CONSULT_ACCEPT_TIMEOUT_SEC} ثانية للقبول`,
      type: 'INSTANT_CONSULT_REQUEST',
      data: { requestId },
    },
  })
}

export async function notifyClientInstantAccepted(clientUserId: string, requestId: string, doctorName: string) {
  await prisma.notification.create({
    data: {
      userId: clientUserId,
      title: '✅ تم قبول الاستشارة',
      body: `${doctorName} قبل طلبك — افتح المحادثة الآن`,
      type: 'INSTANT_CONSULT_ACCEPTED',
      data: { requestId },
    },
  })
}
