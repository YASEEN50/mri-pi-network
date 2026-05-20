// src/app/api/payment/premio/route.ts
import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { processPayment } from '@/infrastructure/pi-network/pi-payment.service'
import { z } from 'zod'

const Schema = z.object({ planType: z.enum(['MONTHLY', 'YEARLY', 'LIFETIME']), payerWallet: z.string().optional() })

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR, Role.FACILITY] })
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { planType, payerWallet } = parsed.data
    const settings = await prisma.premioSettings.findFirst()
    if (!settings) return ok({ error: true, message: 'لم يتم تعيين أسعار البريميو بعد' })

    if (planType === 'MONTHLY' && !settings.isMonthlyEnabled) return ok({ error: true, message: 'الاشتراك الشهري غير متاح' })
    if (planType === 'YEARLY' && !settings.isYearlyEnabled) return ok({ error: true, message: 'الاشتراك السنوي غير متاح' })
    if (planType === 'LIFETIME' && !settings.isLifetimeEnabled) return ok({ error: true, message: 'اشتراك مدى الحياة غير متاح' })

    const now = new Date()
    let price: number
    let expiryDate: Date | null = null

    if (planType === 'MONTHLY') { price = Number(settings.monthlyPrice); expiryDate = new Date(now); expiryDate.setMonth(expiryDate.getMonth() + 1) }
    else if (planType === 'YEARLY') { price = Number(settings.yearlyPrice); expiryDate = new Date(now); expiryDate.setFullYear(expiryDate.getFullYear() + 1) }
    else { price = Number(settings.lifetimePrice) }

    const result = await processPayment({ userId: auth.context.userId, amountTotal: price, type: 'PREMIO_PURCHASE', memo: `اشتراك بريميو ${planType}`, payerWallet })
    if (!result.success) return ok({ error: true, message: result.error })

    await prisma.premio.updateMany({ where: { userId: auth.context.userId, status: 'ACTIVE' }, data: { status: 'CANCELLED' } })
    const premio = await prisma.premio.create({ data: { userId: auth.context.userId, type: planType, status: 'ACTIVE', startDate: now, expiryDate, pricePaid: price, txHash: result.txHash } })
    await prisma.notification.create({ data: { userId: auth.context.userId, title: '💎 مرحباً بك في البريميو!', body: 'تم تفعيل اشتراك البريميو بنجاح', type: 'PREMIO_ACTIVATED', data: { premioId: premio.id, planType } } })

    return ok({ premioId: premio.id, transactionId: result.transactionId, txHash: result.txHash, expiryDate, message: 'تم تفعيل البريميو بنجاح 💎' })
  } catch (err) {
    console.error('[POST /api/payment/premio]', err)
    return serverError()
  }
}
