// GET — حالة ربط الحساب (Pi / Email) للصفحات الثابتة

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ok({ authenticated: false })
    }

    const user = await prisma.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        piUid: true,
        piUsername: true,
        role: true,
        passwordHash: true,
      },
    })

    if (!user) {
      return ok({ authenticated: false })
    }

    return ok({
      authenticated: true,
      userId:        user.id,
      role:          user.role,
      email:         user.email,
      emailVerified: !!user.emailVerified,
      piUid:         user.piUid,
      piUsername:    user.piUsername,
      hasEmail:      !!user.email,
      hasPi:         !!user.piUid,
      hasPassword:   !!user.passwordHash,
      unified:       !!user.email && !!user.piUid,
    })
  } catch (err) {
    console.error('[GET /api/auth/account-status]', err)
    return serverError()
  }
}
