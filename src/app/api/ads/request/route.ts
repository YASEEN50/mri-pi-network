import { NextRequest } from 'next/server'
import { z } from 'zod'
import { AdPlan, PaidAdPlacement, PaidAdStatus } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma } from '@/lib/prisma'
import { created, ok, fromAppError, serverError } from '@/lib/api-response'
import { getAdSettings } from '@/lib/ads/settings'
import { adPlanDurationDays, adPlanPrice } from '@/lib/ads/pricing'

const RequestSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  linkUrl: z.string().url().max(500),
  advertiserName: z.string().min(2).max(120),
  advertiserEmail: z.string().email().max(200),
  advertiserPhone: z.string().max(30).optional(),
  imageUrl: z.string().url().max(500).optional(),
  adPlan: z.nativeEnum(AdPlan).default(AdPlan.MONTHLY),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return ok({ error: true, message: 'يرجى التحقق من البيانات المدخلة' })
    }

    const settings = await getAdSettings()
    if (!settings.isAcceptingRequests) {
      return ok({ error: true, message: 'استقبال طلبات الإعلان متوقف حالياً' })
    }

    const pricePi = adPlanPrice(settings, parsed.data.adPlan)
    const durationDays = adPlanDurationDays(settings, parsed.data.adPlan)

    const ad = await prisma.paidAdvertisement.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        linkUrl: parsed.data.linkUrl,
        advertiserName: parsed.data.advertiserName,
        advertiserEmail: parsed.data.advertiserEmail,
        advertiserPhone: parsed.data.advertiserPhone,
        imageUrl: parsed.data.imageUrl,
        adPlan: parsed.data.adPlan,
        placement: PaidAdPlacement.HOME_SIDEBAR,
        status: PaidAdStatus.PENDING_PAYMENT,
        pricePi,
        durationDays,
        requesterUserId: auth.context.userId,
      },
    })

    return created({
      id: ad.id,
      pricePi,
      durationDays,
      adPlan: ad.adPlan,
      message: 'تم إنشاء الطلب — أكمل الدفع بـ Pi',
    })
  } catch (err) {
    console.error('[POST /api/ads/request]', err)
    return serverError()
  }
}
