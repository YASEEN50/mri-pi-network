import { Resend } from 'resend'

let client: Resend | undefined

/** Lazy init — avoids build failure when RESEND_API_KEY is unset at compile time. */
export function getResendClient(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY
    if (!key) {
      throw new Error('RESEND_API_KEY is not configured')
    }
    client = new Resend(key)
  }
  return client
}
