import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyPiAccessToken } from '@/lib/pi/verify-access-token'
import type { PiPaymentDto } from '@/lib/pi/pi-payment-dto'
import type { AuthSuccess } from '@/infrastructure/auth/providers/role-guard'

export interface IncompletePaymentActor {
  userId: string
  role: Role
}

/** Session, Pi access token, or payment.user_uid (from Pi SDK callback). */
export async function resolveIncompletePaymentActor(
  payment: PiPaymentDto,
  sessionAuth: AuthSuccess | null,
  accessToken?: string,
): Promise<IncompletePaymentActor | null> {
  if (sessionAuth) {
    return { userId: sessionAuth.context.userId, role: sessionAuth.context.role }
  }

  if (accessToken?.trim()) {
    const piUser = await verifyPiAccessToken(accessToken)
    if (piUser) {
      const user = await prisma.user.findFirst({
        where: { piUid: piUser.uid, deletedAt: null },
        select: { id: true, role: true },
      })
      if (user) return { userId: user.id, role: user.role }
    }
  }

  const uid = payment.user_uid?.trim()
  if (uid) {
    const user = await prisma.user.findFirst({
      where: { piUid: uid, deletedAt: null },
      select: { id: true, role: true },
    })
    if (user) return { userId: user.id, role: user.role }
  }

  return null
}
