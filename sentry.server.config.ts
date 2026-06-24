import * as Sentry from '@sentry/nextjs'
import { getSentryInitOptions } from '@/lib/monitoring/sentry-config'

const options = getSentryInitOptions()
if (options) {
  Sentry.init(options)
}
