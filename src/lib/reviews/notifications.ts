import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { appointmentRatingPath } from '@/lib/reviews/paths'
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

/** Prompt client to rate after doctor marks appointment COMPLETED */
export async function notifyReviewRequested(appointmentId: string) {
  const apt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      review: { select: { id: true } },
      doctor: { select: { firstName: true, lastName: true } },
    },
  })
  if (!apt || apt.status !== 'COMPLETED' || !apt.doctorId || apt.review) return

  const doctorName = apt.doctor
    ? `د. ${apt.doctor.firstName} ${apt.doctor.lastName}`
    : 'طبيبك'

  await createNotification(
    apt.clientId,
    '⭐ قيّم تجربتك',
    `اكتمل موعدك مع ${doctorName} (${formatAppointmentWhen(apt.scheduledAt)}). ساعد الآخرين بتقييمك.`,
    'REVIEW_REQUESTED',
    { appointmentId, doctorId: apt.doctorId, ratingPath: appointmentRatingPath(appointmentId) },
  )
}

/** Notify doctor when client submits a review */
export async function notifyReviewReceived(reviewId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      doctor: { select: { userId: true, firstName: true, lastName: true } },
      client: { select: { email: true } },
    },
  })
  if (!review?.doctor?.userId) return

  const clientLabel = review.client?.email ?? 'مريض'
  await createNotification(
    review.doctor.userId,
    '⭐ تقييم جديد',
    `${clientLabel} قيّمك ${review.rating}/5.`,
    'REVIEW_RECEIVED',
    { reviewId, rating: review.rating, appointmentId: review.appointmentId },
  )
}
