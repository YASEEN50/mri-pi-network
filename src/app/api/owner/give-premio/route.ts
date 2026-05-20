// src/app/api/owner/give-premio/route.ts
import { NextRequest } from 'next/server'
import { Role } from '@prisma/client'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const Schema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['MONTHLY', 'YEARLY', 'LIFETIME']),
  notes: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { userId, type, notes } = parsed.data
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, email: true, role: true } })
    if (!user) return ok({ error: true, message: 'المستخدم غير موجود' })

    const now = new Date()
    let expiryDate: Date | null = null
    if (type === 'MONTHLY') { expiryDate = new Date(now); expiryDate.setMonth(expiryDate.getMonth() + 1) }
    else if (type === 'YEARLY') { expiryDate = new Date(now); expiryDate.setFullYear(expiryDate.getFullYear() + 1) }

    await prisma.premio.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'CANCELLED' } })

    const premio = await prisma.premio.create({
      data: { userId, type: 'FREE_GIFT', status: 'ACTIVE', startDate: now, expiryDate, pricePaid: 0, giftedBy: auth.context.userId, notes },
    })

    await prisma.activityLog.create({
      data: { actorId: auth.context.userId, action: 'GIVE_FREE_PREMIO', targetType: 'USER', targetId: userId, details: { type, expiryDate, notes } },
    })

    await prisma.notification.create({
      data: { userId, title: '🎉 تهانينا! حصلت على بريميو مجاني', body: `تم منحك اشتراك بريميو ${type === 'MONTHLY' ? 'شهري' : type === 'YEARLY' ? 'سنوي' : 'مدى الحياة'} مجاناً.`, type: 'PREMIO_GRANTED', data: { premioId: premio.id, type } },
    })

    return ok({ premio, message: 'تم منح البريميو بنجاح' })
  } catch (err) {
    console.error('[POST /api/owner/give-premio]', err)
    return serverError()
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.OWNER] })
    if (!auth.success) return fromAppError(auth.error)

    const email = req.nextUrl.searchParams.get('email')
    if (!email) return ok([])

    const users = await prisma.user.findMany({
      where: { email: { contains: email, mode: 'insensitive' }, deletedAt: null, role: { in: [Role.DOCTOR, Role.FACILITY, Role.CLIENT] } },
      select: { id: true, email: true, role: true, premios: { where: { status: 'ACTIVE' }, select: { type: true, expiryDate: true, status: true }, take: 1 } },
      take: 5,
    })

    return ok(users)
  } catch (err) {
    console.error('[GET /api/owner/give-premio]', err)
    return serverError()
  }
}
