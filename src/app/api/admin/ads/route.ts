import { NextRequest } from 'next/server'
import { PaidAdStatus } from '@prisma/client'
import { z } from 'zod'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'

const ReviewSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'pause']),
  rejectionReason: z.string().min(5).max(500).optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
  pricePi: z.number().min(0).optional(),
})

export async function GET() {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canModerateContent)
    if (!auth.success) return fromAppError(auth.error)

    const ads = await prisma.paidAdvertisement.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    })

    return ok(
      ads.map((ad) => ({
        ...ad,
        pricePi: ad.pricePi != null ? Number(ad.pricePi) : null,
        paidAt: ad.paidAt?.toISOString() ?? null,
      })),
    )
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

    if (parsed.data.action === 'reject' && !parsed.data.rejectionReason?.trim()) {
      return ok({ error: true, message: 'يجب كتابة سبب الرفض' })
    }

    const existing = await prisma.paidAdvertisement.findUnique({ where: { id: parsed.data.id } })
    if (!existing) return ok({ error: true, message: 'الإعلان غير موجود' })

    const now = new Date()
    const durationDays = parsed.data.durationDays ?? existing.durationDays ?? 30
    const pricePi = parsed.data.pricePi ?? (existing.pricePi != null ? Number(existing.pricePi) : undefined)

    if (parsed.data.action === 'approve') {
      if (existing.status !== PaidAdStatus.PENDING_REVIEW) {
        return ok({ error: true, message: 'الإعلان ليس بانتظار المراجعة' })
      }
      if (!existing.paidAt) {
        return ok({ error: true, message: 'لم يتم دفع هذا الإعلان بعد' })
      }

      const endsAt = new Date(now)
      endsAt.setDate(endsAt.getDate() + durationDays)

      const ad = await prisma.paidAdvertisement.update({
        where: { id: parsed.data.id },
        data: {
          status: PaidAdStatus.ACTIVE,
          startsAt: now,
          endsAt,
          durationDays,
          pricePi: pricePi ?? existing.pricePi,
          reviewedBy: auth.context.userId,
          reviewedAt: now,
          rejectionReason: null,
        },
      })
      return ok({ id: ad.id, status: ad.status })
    }

    if (parsed.data.action === 'reject') {
      const ad = await prisma.paidAdvertisement.update({
        where: { id: parsed.data.id },
        data: {
          status: PaidAdStatus.REJECTED,
          rejectionReason: parsed.data.rejectionReason,
          reviewedBy: auth.context.userId,
          reviewedAt: now,
        },
      })
      return ok({ id: ad.id, status: ad.status })
    }

    const ad = await prisma.paidAdvertisement.update({
      where: { id: parsed.data.id },
      data: { status: PaidAdStatus.PAUSED },
    })
    return ok({ id: ad.id, status: ad.status })
  } catch (err) {
    console.error('[POST /api/admin/ads]', err)
    return serverError()
  }
}
