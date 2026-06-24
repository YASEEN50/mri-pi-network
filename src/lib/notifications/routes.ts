/** Deep-link targets for in-app notifications */
export function notificationActionPath(type: string, data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>

  if (typeof d.ratingPath === 'string') return d.ratingPath

  if (type === 'REVIEW_REQUESTED' && typeof d.appointmentId === 'string') {
    return `/appointments/${d.appointmentId}/rating`
  }

  if (
    type === 'APPOINTMENT_CONFIRMED' ||
    type === 'APPOINTMENT_CANCELLED' ||
    type === 'APPOINTMENT_BOOKED' ||
    type === 'PAYMENT_COMPLETED'
  ) {
    return '/dashboard/client/appointments'
  }

  if (type === 'CHAT_MESSAGE' && typeof d.roomId === 'string') {
    return '/dashboard/client/chat'
  }

  if (type === 'REVIEW_RECEIVED') {
    return '/dashboard/doctor/schedule'
  }

  return null
}
