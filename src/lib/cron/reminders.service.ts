// src/lib/cron/reminders.service.ts
// خدمة إنشاء وإرسال تذكيرات المواعيد

import { prisma, db } from '@/lib/prisma'
import { Resend } from 'resend'

const resend    = new Resend(process.env.RESEND_API_KEY)
const BASE_URL  = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const FROM      = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
const APP_NAME  = 'المنصة الطبية'

// إنشاء تذكيرات لموعد جديد (يُستدعى عند إنشاء الموعد)
export async function createRemindersForAppointment(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { scheduledAt: true, status: true },
  })
  if (!appointment || appointment.status === 'CANCELLED') return

  const scheduledAt = new Date(appointment.scheduledAt)
  const now         = new Date()

  const reminders = []

  // تذكير قبل 24 ساعة
  const remind24h = new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000)
  if (remind24h > now) {
    reminders.push({ appointmentId, sendAt: remind24h, type: '24h' })
  }

  // تذكير قبل ساعتين
  const remind2h = new Date(scheduledAt.getTime() - 2 * 60 * 60 * 1000)
  if (remind2h > now) {
    reminders.push({ appointmentId, sendAt: remind2h, type: '2h' })
  }

  if (reminders.length > 0) {
    await db.appointmentReminder.createMany({ data: reminders })
  }
}

// معالجة التذكيرات المستحقة (يُستدعى من cron endpoint)
export async function processDueReminders() {
  const now       = new Date()
  const fiveMin   = new Date(now.getTime() + 5 * 60 * 1000)

  const pending = await db.appointmentReminder.findMany({
    where: { status: 'PENDING', sendAt: { lte: fiveMin } },
    take: 50,
    include: {
      appointment: {
        include: {
          client: {
            include: {
              clientProfile: { select: { firstName: true, lastName: true } },
            },
          },
          doctor: {
            select: { firstName: true, lastName: true, specialization: true },
          },
        },
      },
    },
  })

  const results = await Promise.allSettled(
    pending.map((reminder: any) => sendReminderEmail(reminder))
  )

  return {
    total:   pending.length,
    sent:    results.filter((r: any) => r.status === 'fulfilled').length,
    failed:  results.filter((r: any) => r.status === 'rejected').length,
  }
}

async function sendReminderEmail(reminder: any) {
  const apt  = reminder.appointment
  const date = new Date(apt.scheduledAt)

  const clientName  = apt.client?.clientProfile
    ? `${apt.client.clientProfile.firstName} ${apt.client.clientProfile.lastName}`
    : 'عزيزي المريض'

  const doctorName   = apt.doctor
    ? `د. ${apt.doctor.firstName} ${apt.doctor.lastName}`
    : 'الطبيب'

  const formattedDate = date.toLocaleDateString('ar-SA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const formattedTime = date.toLocaleTimeString('ar-SA', {
    hour: '2-digit', minute: '2-digit',
  })

  const timeLabel = reminder.type === '24h' ? '24 ساعة' : 'ساعتين'

  try {
    await resend.emails.send({
      from: FROM,
      to:   apt.client.email!,
      subject: `تذكير: موعدك مع ${doctorName} بعد ${timeLabel}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #0f172a; color: white; border-radius: 12px;">
          <h2 style="color: #10b981; margin-bottom: 16px;">⏰ تذكير بموعدك</h2>
          <p style="color: #94a3b8; margin-bottom: 8px;">مرحباً ${clientName}،</p>
          <p style="color: #94a3b8; margin-bottom: 20px;">لديك موعد طبي بعد <strong style="color: white;">${timeLabel}</strong>:</p>
          <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <p style="color: white; margin: 0 0 8px;"><strong>الطبيب:</strong> ${doctorName}</p>
            ${apt.doctor?.specialization ? `<p style="color: #94a3b8; margin: 0 0 8px;"><strong>التخصص:</strong> ${apt.doctor.specialization}</p>` : ''}
            <p style="color: white; margin: 0 0 8px;"><strong>التاريخ:</strong> ${formattedDate}</p>
            <p style="color: white; margin: 0;"><strong>الوقت:</strong> ${formattedTime}</p>
          </div>
          <a href="${BASE_URL}/appointments" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            عرض تفاصيل الموعد
          </a>
          <p style="color: #475569; font-size: 12px; margin-top: 20px;">إذا أردت إلغاء الموعد، يرجى الإلغاء قبل ساعة على الأقل.</p>
        </div>
      `,
    })

    await db.appointmentReminder.update({
      where: { id: reminder.id },
      data:  { status: 'SENT', sentAt: new Date() },
    })
  } catch (err: any) {
    await db.appointmentReminder.update({
      where: { id: reminder.id },
      data:  { status: 'FAILED', error: err.message?.slice(0, 200) },
    })
    throw err
  }
}

// إلغاء تذكيرات موعد (عند الإلغاء)
export async function cancelRemindersForAppointment(appointmentId: string) {
  await db.appointmentReminder.updateMany({
    where: { appointmentId, status: 'PENDING' },
    data:  { status: 'CANCELLED' },
  })
}
