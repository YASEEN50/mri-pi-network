import { prisma } from '@/lib/prisma'
import { consumeBackupCode, verifyStoredTotp } from '@/lib/mfa/totp'

export async function verifyUserMfaCode(
  userId: string,
  code: string,
): Promise<{ verified: boolean; remainingBackupCodes?: string[] }> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, mfaEnabled: true },
    select: { id: true, mfaSecret: true, mfaBackupCodes: true },
  })

  if (!user?.mfaSecret) return { verified: false }

  const normalized = code.replace(/\s/g, '')
  let verified = await verifyStoredTotp(user.mfaSecret, normalized)
  let remainingBackupCodes: string[] | undefined

  if (!verified) {
    const backup = await consumeBackupCode(normalized, user.mfaBackupCodes)
    if (backup.matched) {
      verified = true
      remainingBackupCodes = backup.remaining
    }
  }

  return { verified, remainingBackupCodes }
}
