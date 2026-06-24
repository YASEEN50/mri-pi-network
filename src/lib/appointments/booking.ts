import { AppointmentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  type AvailabilityWindow,
  type BookableSlot,
  generateSlotsForWindow,
  parseDateOnly,
  rangesOverlap,
  slotFitsAvailability,
  slotToDate,
  dayOfWeekFromDate,
} from '@/lib/appointments/slots'

interface ExistingAppointment {
  scheduledAt: Date
  duration: number
}

export async function hasAppointmentConflict(params: {
  doctorId?: string
  facilityId?: string
  scheduledAt: Date
  duration: number
  excludeId?: string
}): Promise<boolean> {
  const { doctorId, facilityId, scheduledAt, duration, excludeId } = params
  if (!doctorId && !facilityId) return false

  const candidates = await prisma.appointment.findMany({
    where: {
      deletedAt: null,
      status: { not: AppointmentStatus.CANCELLED },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(doctorId ? { doctorId } : { facilityId }),
    },
    select: { scheduledAt: true, duration: true },
  })

  return candidates.some(appt =>
    rangesOverlap(scheduledAt, duration, appt.scheduledAt, appt.duration),
  )
}

export async function loadExistingAppointmentsForDate(
  date: string,
  params: { doctorId?: string; facilityId?: string },
): Promise<ExistingAppointment[]> {
  const dayStart = slotToDate(date, '00:00')
  const dayEnd = new Date(slotToDate(date, '23:59').getTime() + 60_000)

  return prisma.appointment.findMany({
    where: {
      deletedAt: null,
      status: { not: AppointmentStatus.CANCELLED },
      scheduledAt: { gte: dayStart, lt: dayEnd },
      ...(params.doctorId ? { doctorId: params.doctorId } : { facilityId: params.facilityId }),
    },
    select: { scheduledAt: true, duration: true },
  })
}

function filterBookableSlots(
  candidates: BookableSlot[],
  existing: ExistingAppointment[],
  now: Date,
): BookableSlot[] {
  return candidates.filter(slot => {
    const start = new Date(slot.scheduledAt)
    if (start <= now) return false
    return !existing.some(appt =>
      rangesOverlap(start, slot.duration, appt.scheduledAt, appt.duration),
    )
  })
}

export async function getAvailableSlots(params: {
  date: string
  doctorId?: string
  facilityId?: string
}): Promise<BookableSlot[]> {
  const { date, doctorId, facilityId } = params
  if (!parseDateOnly(date)) return []
  if (!doctorId && !facilityId) return []

  const dow = dayOfWeekFromDate(date)

  const windows: AvailabilityWindow[] = await prisma.availability.findMany({
    where: {
      isActive: true,
      dayOfWeek: dow,
      ...(doctorId ? { doctorId } : { facilityId }),
    },
    select: {
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      slotMinutes: true,
      isActive: true,
    },
  })

  if (!windows.length) return []

  const existing = await loadExistingAppointmentsForDate(date, { doctorId, facilityId })
  const now = new Date()

  const candidates = windows.flatMap(w => generateSlotsForWindow(date, w))
  candidates.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))

  const unique = new Map<string, BookableSlot>()
  for (const slot of candidates) unique.set(slot.scheduledAt, slot)

  return filterBookableSlots([...unique.values()], existing, now)
}

export async function assertBookableSlot(params: {
  scheduledAt: Date
  duration: number
  doctorId?: string
  facilityId?: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { scheduledAt, duration, doctorId, facilityId } = params

  if (scheduledAt <= new Date()) {
    return { ok: false, message: 'يجب أن يكون موعد الحجز في المستقبل' }
  }

  const windows: AvailabilityWindow[] = await prisma.availability.findMany({
    where: {
      isActive: true,
      ...(doctorId ? { doctorId } : { facilityId }),
    },
    select: {
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      slotMinutes: true,
      isActive: true,
    },
  })

  if (!windows.length) {
    return { ok: false, message: 'لا توجد أوقات عمل متاحة للحجز' }
  }

  if (!slotFitsAvailability(scheduledAt, duration, windows)) {
    return { ok: false, message: 'الوقت المختار خارج أوقات العمل المتاحة' }
  }

  if (await hasAppointmentConflict({ doctorId, facilityId, scheduledAt, duration })) {
    return { ok: false, message: 'هذا الوقت محجوز بالفعل، يرجى اختيار وقت آخر' }
  }

  return { ok: true }
}
