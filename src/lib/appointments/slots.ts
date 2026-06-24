import { DayOfWeek } from '@prisma/client'

/** Booking times are interpreted in Saudi Arabia (AST, UTC+3). */
export const BOOKING_TZ_OFFSET = '+03:00'

const JS_DAY_TO_DOW: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
}

export function parseDateOnly(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

export function dayOfWeekFromDate(date: string): DayOfWeek {
  const d = new Date(`${date}T12:00:00${BOOKING_TZ_OFFSET}`)
  return JS_DAY_TO_DOW[d.getUTCDay()]
}

export function slotToDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${BOOKING_TZ_OFFSET}`)
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

export function formatTimeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export interface AvailabilityWindow {
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  slotMinutes: number
  isActive: boolean
}

export interface BookableSlot {
  scheduledAt: string
  timeLabel: string
  duration: number
}

export function generateSlotsForWindow(
  date: string,
  window: Pick<AvailabilityWindow, 'startTime' | 'endTime' | 'slotMinutes'>,
): BookableSlot[] {
  const startMin = parseTimeToMinutes(window.startTime)
  const endMin = parseTimeToMinutes(window.endTime)
  const step = window.slotMinutes
  if (step <= 0 || endMin <= startMin) return []

  const slots: BookableSlot[] = []
  for (let t = startMin; t + step <= endMin; t += step) {
    const timeLabel = formatTimeLabel(t)
    slots.push({
      scheduledAt: slotToDate(date, timeLabel).toISOString(),
      timeLabel,
      duration: step,
    })
  }
  return slots
}

export function rangesOverlap(
  aStart: Date,
  aDurationMin: number,
  bStart: Date,
  bDurationMin: number,
): boolean {
  const aEnd = aStart.getTime() + aDurationMin * 60_000
  const bEnd = bStart.getTime() + bDurationMin * 60_000
  return aStart.getTime() < bEnd && bStart.getTime() < aEnd
}

export function scheduledAtToMinutesInRiyadh(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

export function dateStringInRiyadh(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' })
}

export function slotFitsAvailability(
  scheduledAt: Date,
  duration: number,
  windows: AvailabilityWindow[],
): boolean {
  const date = dateStringInRiyadh(scheduledAt)
  const dow = dayOfWeekFromDate(date)
  const slotStartMin = scheduledAtToMinutesInRiyadh(scheduledAt)

  for (const w of windows) {
    if (!w.isActive || w.dayOfWeek !== dow) continue
    const winStart = parseTimeToMinutes(w.startTime)
    const winEnd = parseTimeToMinutes(w.endTime)
    if (slotStartMin >= winStart && slotStartMin + duration <= winEnd) {
      return true
    }
  }
  return false
}
