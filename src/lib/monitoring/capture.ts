import * as Sentry from '@sentry/nextjs'
import { isSentryEnabled } from '@/lib/monitoring/sentry-config'

export function captureMonitoringException(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  if (!isSentryEnabled()) return
  if (context) Sentry.setContext('request', context)
  Sentry.captureException(err)
}
