import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getSentryInitOptions,
  isSentryEnabled,
  sentryTracesSampleRate,
} from '@/lib/monitoring/sentry-config'

describe('sentry-config', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.SENTRY_DSN
    delete process.env.NEXT_PUBLIC_SENTRY_DSN
  })

  afterEach(() => {
    process.env = env
  })

  it('is disabled without DSN', () => {
    expect(isSentryEnabled()).toBe(false)
    expect(getSentryInitOptions()).toBeNull()
  })

  it('is enabled when DSN is set', () => {
    process.env.SENTRY_DSN = 'https://example@sentry.io/1'
    expect(isSentryEnabled()).toBe(true)
    const opts = getSentryInitOptions()
    expect(opts?.dsn).toBe('https://example@sentry.io/1')
    expect(opts?.sendDefaultPii).toBe(false)
  })

  it('parses traces sample rate', () => {
    process.env.SENTRY_TRACES_SAMPLE_RATE = '0.25'
    expect(sentryTracesSampleRate()).toBe(0.25)
  })
})
