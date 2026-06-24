/** Client rating page for a completed appointment */
export function appointmentRatingPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/rating`
}

export function isReviewPending(apt: {
  status: string
  doctorId?: string | null
  hasReview?: boolean
}): boolean {
  return apt.status === 'COMPLETED' && !!apt.doctorId && !apt.hasReview
}
