import { NextRequest } from 'next/server'
import { PaidAdStatus } from '@prisma/client'
import { z } from 'zod'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'

const ReviewSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'pause']),
})

export async function GET() {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canModerateContent)
    if (!auth.success) return fromAppError(auth.error)

    const ads = await prisma.paidAdvertisement.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    })

    return ok(ads)
  } catch (err) {
    console.error('[GET /api/admin/ads]', err)
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canModerateContent)
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = ReviewSchema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const statusMap = {
      approve: PaidAdStatus.ACTIVE,
      reject: PaidAdStatus.REJECTED,
      pause: PaidAdStatus.PAUSED,
    } as const

    const ad = await prisma.paidAdvertisement.update({
      where: { id: parsed.data.id },
      data: {
        status: statusMap[parsed.data.action],
        ...(parsed.data.action === 'approve' ? { startsAt: new Date() } : {}),
      },
    })

    return ok({ id: ad.id, status: ad.status })
  } catch (err) {
    console.error('[POST /api/admin/ads]', err)
    return serverError()
  }
}
