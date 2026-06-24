import * as Sentry from '@sentry/nextjs'
import { getSentryInitOptions } from '@/lib/monitoring/sentry-config'

const options = getSentryInitOptions()
if (options) {
  Sentry.init({
    ...options,
    tracesSampleRate: Math.min(options.tracesSampleRate, 0.05),
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
