// src/app/api/onboarding/client/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { z } from 'zod'

const Schema = z.object({
  fullName: z.string().min(2),
  phone:    z.string().min(9),
  gender:   z.enum(['MALE', 'FEMALE']),
  dateOfBirth: z.string().optional(),
  city:     z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return ok({ error: true, message: 'غير مصرح' })

    const body   = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const { fullName, phone, gender, dateOfBirth, city } = parsed.data
    const userId = session.user.id

    // تقسيم الاسم الكامل
    const parts     = fullName.trim().split(' ')
    const firstName = parts[0]
    const lastName  = parts.slice(1).join(' ') || ''

    // إنشاء أو تحديث الـ clientProfile
    await prisma.clientProfile.upsert({
      where: { userId },
      update: {
        firstName,
        lastName,
        phone,
        gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        city,
      },
      create: {
        userId,
        firstName,
        lastName,
        phone,
        gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        city,
        country: 'SA',
        allergies: [],
        chronicDiseases: [],
      },
    })

    return ok({ message: 'تم إكمال الملف الشخصي بنجاح' })
  } catch (err) {
    console.error('[POST /api/onboarding/client]', err)
    return serverError()
  }
}
