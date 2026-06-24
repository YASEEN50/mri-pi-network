import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError, fromZodError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { BusinessRuleError } from '@/core/errors'
import { decryptMfaSecret } from '@/lib/mfa/secret-crypto'
import { generateBackupCodes, verifyTotpCode } from '@/lib/mfa/totp'

const PENDING_PREFIX = 'mfa-pending:'

const Schema = z.object({
  code: z.string().min(6).max(8),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.ADMIN, Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const pending = await prisma.verificationToken.findFirst({
      where: {
        identifier: `${PENDING_PREFIX}${auth.context.userId}`,
        expires: { gt: new Date() },
      },
    })
    if (!pending) {
      return ok({ error: true, message: 'انتهت جلسة الإعداد — أعد المسح من جديد' })
    }

    const secret = decryptMfaSecret(pending.token)
    if (!(await verifyTotpCode(secret, parsed.data.code))) {
      return ok({ error: true, message: 'رمز التحقق غير صحيح' })
    }

    const { plain, hashed } = await generateBackupCodes()

    await prisma.user.update({
      where: { id: auth.context.userId },
      data: {
        mfaEnabled: true,
        mfaSecret: pending.token,
        mfaBackupCodes: hashed,
      },
    })

    await prisma.verificationToken.deleteMany({
      where: { identifier: `${PENDING_PREFIX}${auth.context.userId}` },
    })

    return ok({
      message: 'تم تفعيل MFA بنجاح',
      backupCodes: plain,
    })
  } catch (err) {
    if (err instanceof BusinessRuleError) return fromAppError(err)
    console.error('[POST /api/mfa/enable]', err)
    return serverError()
  }
}
