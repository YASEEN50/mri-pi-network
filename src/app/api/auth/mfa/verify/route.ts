import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, serverError, fromZodError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { verifyMfaChallengeToken } from '@/lib/mfa/challenge-token'
import { createMfaSignInToken } from '@/lib/mfa/signin-token'
import { consumeBackupCode, verifyStoredTotp } from '@/lib/mfa/totp'

const Schema = z.object({
  challengeToken: z.string().min(10),
  code: z.string().min(6).max(16),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const challenge = verifyMfaChallengeToken(parsed.data.challengeToken)
    if (!challenge) {
      return ok({ error: true, message: 'انتهت صلاحية جلسة التحقق — أعد تسجيل الدخول' })
    }

    const user = await prisma.user.findFirst({
      where: { id: challenge.userId, deletedAt: null, mfaEnabled: true },
      select: { id: true, mfaSecret: true, mfaBackupCodes: true },
    })

    if (!user?.mfaSecret) {
      return ok({ error: true, message: 'MFA غير مفعّل لهذا الحساب' })
    }

    const code = parsed.data.code.replace(/\s/g, '')
    let verified = await verifyStoredTotp(user.mfaSecret, code)

    if (!verified) {
      const backup = await consumeBackupCode(code, user.mfaBackupCodes)
      if (backup.matched) {
        verified = true
        await prisma.user.update({
          where: { id: user.id },
          data: { mfaBackupCodes: backup.remaining },
        })
      }
    }

    if (!verified) {
      return ok({ error: true, message: 'رمز التحقق غير صحيح' })
    }

    const signInToken = await createMfaSignInToken(user.id)

    return ok({ signInToken, userId: user.id })
  } catch (err) {
    console.error('[POST /api/auth/mfa/verify]', err)
    return serverError()
  }
}
