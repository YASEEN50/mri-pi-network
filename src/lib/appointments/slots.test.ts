import { describe, it, expect } from 'vitest'
import { DayOfWeek } from '@prisma/client'
import {
  parseDateOnly,
  rangesOverlap,
  generateSlotsForWindow,
  slotFitsAvailability,
  formatTimeLabel,
} from '@/lib/appointments/slots'

describe('appointment slots', () => {
  it('parseDateOnly accepts YYYY-MM-DD', () => {
    expect(parseDateOnly('2026-05-20')).toBe(true)
    expect(parseDateOnly('2026-5-20')).toBe(false)
    expect(parseDateOnly('invalid')).toBe(false)
  })

  it('formatTimeLabel pads hours and minutes', () => {
    expect(formatTimeLabel(9 * 60 + 5)).toBe('09:05')
    expect(formatTimeLabel(14 * 60)).toBe('14:00')
  })

  it('generateSlotsForWindow produces non-overlapping slots', () => {
    const slots = generateSlotsForWindow('2026-05-20', {
      startTime: '09:00',
      endTime: '10:00',
      slotMinutes: 30,
    })
    expect(slots).toHaveLength(2)
    expect(slots[0].timeLabel).toBe('09:00')
    expect(slots[1].timeLabel).toBe('09:30')
  })

  it('rangesOverlap detects intersection', () => {
    const a = new Date('2026-05-20T09:00:00+03:00')
    const b = new Date('2026-05-20T09:15:00+03:00')
    expect(rangesOverlap(a, 30, b, 30)).toBe(true)
    expect(rangesOverlap(a, 15, b, 15)).toBe(false)
  })

  it('slotFitsAvailability matches day and window', () => {
    const scheduledAt = new Date('2026-05-20T09:00:00+03:00') // Wednesday
    const windows = [
      {
        dayOfWeek: DayOfWeek.WEDNESDAY,
        startTime: '08:00',
        endTime: '12:00',
        slotMinutes: 30,
        isActive: true,
      },
    ]
    expect(slotFitsAvailability(scheduledAt, 30, windows)).toBe(true)
    expect(
      slotFitsAvailability(scheduledAt, 30, [
        { ...windows[0], dayOfWeek: DayOfWeek.MONDAY },
      ]),
    ).toBe(false)
  })
})
