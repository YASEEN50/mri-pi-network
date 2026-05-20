// src/app/api/auth/select-role/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ok, serverError } from '@/lib/api-response'
import { Role } from '@prisma/client'
import { z } from 'zod'

const Schema = z.object({
  role: z.enum([Role.CLIENT, Role.DOCTOR, Role.FACILITY]),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return ok({ error: true, message: 'غير مصرح' })

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'دور غير صحيح' })

    const { role } = parsed.data
    const userId = session.user.id

    // فقط المستخدمون بدون profile يمكنهم تغيير الدور
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        clientProfile: true,
        doctorProfile: true,
        facilityProfile: true,
      },
    })

    const hasProfile = user?.clientProfile || user?.doctorProfile || user?.facilityProfile
    if (hasProfile) return ok({ error: true, message: 'لا يمكن تغيير الدور بعد إكمال الملف الشخصي' })

    await prisma.user.update({
      where: { id: userId },
      data: { role },
    })

    return ok({ message: 'تم تحديد الدور بنجاح' })
  } catch (err) {
    console.error('[POST /api/auth/select-role]', err)
    return serverError()
  }
}
