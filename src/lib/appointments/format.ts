const RIYADH_TZ = 'Asia/Riyadh'

export function formatAppointmentWhen(scheduledAt: Date): string {
  const date = scheduledAt.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: RIYADH_TZ,
  })
  const time = scheduledAt.toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: RIYADH_TZ,
  })
  return `${date} — ${time}`
}
