import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { formatAppointmentWhen } from '@/lib/appointments/format'

async function createNotification(
  userId: string,
  title: string,
  body: string,
  type: string,
  data: Prisma.InputJsonValue,
) {
  await prisma.notification.create({
    data: { userId, title, body, type, data },
  })
}

export async function notifyAppointmentBooked(appointmentId: string) {
  const apt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      client: { select: { email: true } },
      doctor: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
      facility: { select: { userId: true, name: true } },
    },
  })
  if (!apt) return

  const when = formatAppointmentWhen(apt.scheduledAt)
  const clientLabel = apt.client?.email ?? 'مريض'

  if (apt.doctor?.userId) {
    await createNotification(
      apt.doctor.userId,
      '📅 طلب موعد جديد',
      `${clientLabel} طلب موعداً في ${when}. يرجى التأكيد من جدولك.`,
      'APPOINTMENT_BOOKED',
      { appointmentId },
    )
  }

  if (apt.facility?.userId) {
    await createNotification(
      apt.facility.userId,
      '📅 طلب موعد جديد',
      `${clientLabel} طلب موعداً في ${when} لدى ${apt.facility.name}.`,
      'APPOINTMENT_BOOKED',
      { appointmentId },
    )
  }
}

export async function notifyAppointmentConfirmed(appointmentId: string) {
  const apt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      doctor: { select: { firstName: true, lastName: true } },
      facility: { select: { name: true } },
    },
  })
  if (!apt) return

  const when = formatAppointmentWhen(apt.scheduledAt)
  const provider = apt.doctor
    ? `د. ${apt.doctor.firstName} ${apt.doctor.lastName}`
    : apt.facility?.name ?? 'مقدم الخدمة'

  await createNotification(
    apt.clientId,
    '✅ تم تأكيد موعدك',
    `أكّد ${provider} موعدك في ${when}.`,
    'APPOINTMENT_CONFIRMED',
    { appointmentId },
  )
}

export async function notifyAppointmentCancelled(appointmentId: string) {
  const apt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      doctor: { select: { userId: true, firstName: true, lastName: true } },
      facility: { select: { userId: true, name: true } },
    },
  })
  if (!apt) return

  const when = formatAppointmentWhen(apt.scheduledAt)

  await createNotification(
    apt.clientId,
    '❌ تم إلغاء الموعد',
    `تم إلغاء موعدك المقرر في ${when}.`,
    'APPOINTMENT_CANCELLED',
    { appointmentId },
  )

  if (apt.doctor?.userId) {
    await createNotification(
      apt.doctor.userId,
      '❌ إلغاء موعد',
      `تم إلغاء موعد كان مقرراً في ${when}.`,
      'APPOINTMENT_CANCELLED',
      { appointmentId },
    )
  }

  if (apt.facility?.userId) {
    await createNotification(
      apt.facility.userId,
      '❌ إلغاء موعد',
      `تم إلغاء موعد كان مقرراً في ${when}.`,
      'APPOINTMENT_CANCELLED',
      { appointmentId },
    )
  }
}
