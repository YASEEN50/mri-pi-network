/** Client rating page for a completed appointment */
export function appointmentRatingPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/rating`
}

/** Client rating page for a completed instant consult */
export function instantConsultRatingPath(instantConsultId: string): string {
  return `/consult-now/${instantConsultId}/rating`
}

export function isReviewPending(apt: {
  status: string
  doctorId?: string | null
  hasReview?: boolean
}): boolean {
  return apt.status === 'COMPLETED' && !!apt.doctorId && !apt.hasReview
}

export function isInstantConsultReviewPending(consult: {
  status: string
  doctorId?: string | null
  hasReview?: boolean
}): boolean {
  return isReviewPending(consult)
}
