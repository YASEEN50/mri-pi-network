/** Shared Sentry options — disabled when no DSN is set */

export function isSentryEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)
  }
  return Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN)
}

export function resolveSentryDsn(): string | undefined {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_SENTRY_DSN
  }
  return process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
}

export function sentryEnvironment(): string {
  return (
    process.env.SENTRY_ENVIRONMENT ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    'development'
  )
}

export function sentryTracesSampleRate(): number {
  const raw = process.env.SENTRY_TRACES_SAMPLE_RATE
  if (raw === undefined || raw === '') return 0.1
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.1
}

export function getSentryInitOptions(): {
  dsn: string
  environment: string
  tracesSampleRate: number
  enabled: boolean
  sendDefaultPii: boolean
} | null {
  const dsn = resolveSentryDsn()
  if (!dsn) return null

  const enabled =
    process.env.SENTRY_ENABLED === 'true' ||
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.VERCEL)

  return {
    dsn,
    environment: sentryEnvironment(),
    tracesSampleRate: sentryTracesSampleRate(),
    enabled,
    sendDefaultPii: false,
  }
}
