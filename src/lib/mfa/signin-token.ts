import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

const SIGNIN_PREFIX = 'mfa-signin:'
const TTL_MS = 60_000

/** One-time token consumed by the mfa-token NextAuth credentials provider */
export async function createMfaSignInToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + TTL_MS)

  await prisma.verificationToken.deleteMany({
    where: { identifier: `${SIGNIN_PREFIX}${userId}` },
  })

  await prisma.verificationToken.create({
    data: {
      identifier: `${SIGNIN_PREFIX}${userId}`,
      token,
      expires,
    },
  })

  return token
}

export async function consumeMfaSignInToken(userId: string, token: string): Promise<boolean> {
  const row = await prisma.verificationToken.findFirst({
    where: {
      identifier: `${SIGNIN_PREFIX}${userId}`,
      token,
      expires: { gt: new Date() },
    },
  })
  if (!row) return false

  await prisma.verificationToken.delete({
    where: {
      identifier_token: { identifier: row.identifier, token: row.token },
    },
  })
  return true
}
