import { createHmac, timingSafeEqual } from 'crypto'

interface ChallengePayload {
  userId: string
  exp: number
}

const TTL_MS = 5 * 60 * 1000

function signingKey(): string {
  return process.env.NEXTAUTH_SECRET ?? 'dev-mfa-key-change-me'
}

export function createMfaChallengeToken(userId: string): string {
  const payload: ChallengePayload = { userId, exp: Date.now() + TTL_MS }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', signingKey()).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifyMfaChallengeToken(token: string): { userId: string } | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [data, sig] = parts
  const expected = createHmac('sha256', signingKey()).update(data).digest('base64url')
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as ChallengePayload
    if (!payload.userId || payload.exp < Date.now()) return null
    return { userId: payload.userId }
  } catch {
    return null
  }
}
