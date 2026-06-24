import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { canAccessVideoCall, getVideoRoomName } from '@/lib/appointments/online-video'

describe('online video access', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T09:00:00+03:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('getVideoRoomName sanitizes appointment id', () => {
    expect(getVideoRoomName('abc-123-def')).toMatch(/^mriConsult/)
  })

  it('allows confirmed ONLINE appointment during window', () => {
    const scheduledAt = new Date('2026-05-20T09:00:00+03:00')
    const result = canAccessVideoCall({
      type: 'ONLINE',
      status: 'CONFIRMED',
      scheduledAt,
      duration: 30,
    })
    expect(result.allowed).toBe(true)
  })

  it('rejects in-person appointments', () => {
    const result = canAccessVideoCall({
      type: 'IN_PERSON',
      status: 'CONFIRMED',
      scheduledAt: new Date('2026-05-20T09:00:00+03:00'),
      duration: 30,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('not_online')
  })

  it('rejects too early join', () => {
    vi.setSystemTime(new Date('2026-05-20T08:00:00+03:00'))
    const result = canAccessVideoCall({
      type: 'ONLINE',
      status: 'CONFIRMED',
      scheduledAt: new Date('2026-05-20T09:00:00+03:00'),
      duration: 30,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('too_early')
  })
})
