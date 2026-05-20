// src/app/api/premio/my-premio/route.ts
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const premio = await prisma.premio.findFirst({ where: { userId: auth.context.userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } })
    if (!premio) return ok(null)

    if (premio.expiryDate && new Date(premio.expiryDate) < new Date()) {
      await prisma.premio.update({ where: { id: premio.id }, data: { status: 'EXPIRED' } })
      return ok(null)
    }

    return ok({ id: premio.id, type: premio.type, status: premio.status, startDate: premio.startDate, expiryDate: premio.expiryDate })
  } catch (err) {
    console.error('[GET /api/premio/my-premio]', err)
    return serverError()
  }
}
