# Sentry Monitoring

Optional error tracking and performance traces. **Disabled by default** until you set a DSN.

## Environment variables (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `SENTRY_DSN` | Yes (server) | Server/edge DSN from Sentry project |
| `NEXT_PUBLIC_SENTRY_DSN` | Recommended | Browser DSN (can match server DSN) |
| `SENTRY_ENVIRONMENT` | No | `production`, `preview`, etc. (defaults to `VERCEL_ENV`) |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `0.0`–`1.0` (default `0.1`) |
| `SENTRY_ENABLED` | No | Set `true` to enable in non-production |
| `SENTRY_ORG` | No | For source map upload |
| `SENTRY_PROJECT` | No | For source map upload |
| `SENTRY_AUTH_TOKEN` | No | CI/Vercel build — uploads source maps |

## What is instrumented

- **Server / Edge:** `src/instrumentation.ts` + `onRequestError`
- **Client:** `src/instrumentation-client.ts`
- **React render errors:** `src/app/global-error.tsx`
- **API helpers:** pass `cause` to `serverError(msg, err)` → `captureMonitoringException`
- **Health check:** `GET /api/health` → `services.sentry`

## Privacy

- `sendDefaultPii: false` — no automatic user email/IP to Sentry
- Set user context manually only when needed

## Files

- `src/lib/monitoring/sentry-config.ts` — shared init options
- `src/lib/monitoring/capture.ts` — `captureMonitoringException`
- `sentry.server.config.ts`, `sentry.edge.config.ts`

## Verify

1. Add DSN in Vercel → redeploy
2. `GET /api/health` should show `"sentry": { "status": "configured" }`
3. Trigger a test error or use Sentry dashboard
