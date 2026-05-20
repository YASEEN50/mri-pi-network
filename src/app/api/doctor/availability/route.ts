// src/app/api/doctor/availability/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { prisma } from '@/lib/prisma'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { Role, DayOfWeek } from '@prisma/client'
import { z } from 'zod'

const SlotSchema = z.object({
  day:         z.nativeEnum(DayOfWeek),
  startTime:   z.string().regex(/^\d{2}:\d{2}$/),
  endTime:     z.string().regex(/^\d{2}:\d{2}$/),
  slotMinutes: z.number().min(10).max(180).default(30),
  isActive:    z.boolean().default(true),
})

const Schema = z.array(SlotSchema)

// GET — جلب أوقات العمل الحالية
export async function GET() {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { id: true },
    })
    if (!doctor) return ok([])

    const slots = await prisma.availability.findMany({
      where:   { doctorId: doctor.id },
      orderBy: { dayOfWeek: 'asc' },
    })

    return ok(slots.map((s: any) => ({
      id:          s.id,
      day:         s.dayOfWeek,
      startTime:   s.startTime,
      endTime:     s.endTime,
      slotMinutes: s.slotMinutes,
      isActive:    s.isActive,
    })))
  } catch (err) {
    console.error('[GET /api/doctor/availability]', err)
    return serverError()
  }
}

// POST — حفظ أوقات العمل (يحذف القديم ويُنشئ الجديد)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth({ roles: [Role.DOCTOR] })
    if (!auth.success) return fromAppError(auth.error)

    const body   = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return ok({ error: true, message: 'بيانات غير صحيحة' })

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: auth.context.userId },
      select: { id: true },
    })
    if (!doctor) return ok({ error: true, message: 'ملف الطبيب غير موجود' })

    // حذف الأوقات القديمة وإنشاء الجديدة في transaction
    await prisma.$transaction([
      prisma.availability.deleteMany({ where: { doctorId: doctor.id } }),
      prisma.availability.createMany({
        data: parsed.data.map((s: any) => ({
          doctorId:    doctor.id,
          dayOfWeek:   s.day,
          startTime:   s.startTime,
          endTime:     s.endTime,
          slotMinutes: s.slotMinutes,
          isActive:    s.isActive,
        })),
      }),
    ])

    return ok({ message: 'تم حفظ أوقات العمل بنجاح' })
  } catch (err) {
    console.error('[POST /api/doctor/availability]', err)
    return serverError()
  }
}
