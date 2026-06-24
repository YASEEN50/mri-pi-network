import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { requiresMfaRole } from '@/lib/mfa/session-flags'

export async function GET(_req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    if (!requiresMfaRole(auth.context.role)) {
      return ok({ required: false, enabled: false })
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.context.userId },
      select: { mfaEnabled: true, email: true },
    })

    return ok({
      required: true,
      enabled: user?.mfaEnabled ?? false,
      email: user?.email,
    })
  } catch (err) {
    console.error('[GET /api/mfa/status]', err)
    return serverError()
  }
}
