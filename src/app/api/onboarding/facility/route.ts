// src/app/api/onboarding/facility/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { ApprovalStatus, FacilityType } from '@prisma/client'
import { z } from 'zod'

const Schema = z.object({
  name:          z.string().min(2),
  type:          z.nativeEnum(FacilityType),
  phone:         z.string().min(9),
  licenseNumber: z.string().min(3),
  city:          z.string().min(1),
  country:       z.string().length(2).optional().default('SA'),
  address:       z.string().optional(),
  description:   z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.warn('[onboarding/facility] rejected: no session')
      return ok({ error: true, message: 'غير مصرح' })
    }

    const body   = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const data   = parsed.data
    const userId = session.user.id

    // تحقق أن licenseNumber غير مستخدم
    const existingLicense = await prisma.facilityProfile.findUnique({
      where: { licenseNumber: data.licenseNumber },
      select: { id: true },
    })
    if (existingLicense) return ok({ error: true, message: 'رقم الترخيص مستخدم مسبقاً' })

    await prisma.facilityProfile.upsert({
      where: { userId },
      update: {
        name:          data.name,
        type:          data.type,
        phone:         data.phone,
        licenseNumber: data.licenseNumber,
        city:          data.city,
        country:       data.country,
        address:       data.address ?? '',
        description:   data.description,
      },
      create: {
        userId,
        name:           data.name,
        type:           data.type,
        phone:          data.phone,
        licenseNumber:  data.licenseNumber,
        licenseDocUrl:  '', // سيُرفع لاحقاً
        city:           data.city,
        address:        data.address ?? '',
        description:    data.description,
        approvalStatus: ApprovalStatus.PENDING,
        country:        data.country,
      },
    })

    console.log('[onboarding/facility] facility profile saved', { userId, licenseNumber: data.licenseNumber })
    return ok({ message: 'تم إرسال طلبك بنجاح، في انتظار المراجعة' })
  } catch (err) {
    console.error('[POST /api/onboarding/facility]', err)
    return serverError()
  }
}
