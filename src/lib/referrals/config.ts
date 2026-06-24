/** Default Pi reward credited to referring doctor when referral is completed */
export const REFERRAL_REWARD_PI = Number(process.env.REFERRAL_REWARD_PI ?? '1')

export const REFERRAL_STATUS_TRANSITIONS = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
} as const
