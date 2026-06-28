import { NextRequest } from 'next/server'
import { z } from 'zod'
import { PaidAdPlacement } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { created, ok, serverError } from '@/lib/api-response'

const RequestSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  linkUrl: z.string().url().max(500),
  advertiserName: z.string().min(2).max(120),
  advertiserEmail: z.string().email().max(200),
  advertiserPhone: z.string().max(30).optional(),
  imageUrl: z.string().url().max(500).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return ok({ error: true, message: 'يرجى التحقق من البيانات المدخلة' })
    }

    const ad = await prisma.paidAdvertisement.create({
      data: {
        ...parsed.data,
        placement: PaidAdPlacement.HOME_SIDEBAR,
      },
    })

    return created({
      id: ad.id,
      message: 'تم استلام طلب الإعلان — سيتواصل معك فريقنا بعد المراجعة والدفع',
    })
  } catch (err) {
    console.error('[POST /api/ads/request]', err)
    return serverError()
  }
}
