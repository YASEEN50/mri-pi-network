// src/app/api/health/route.ts
// Health check endpoint — للتحقق من حالة النظام
import { NextResponse } from 'next/server'
import { getMissingR2EnvVars, getStorageProvider } from '@/infrastructure/storage/storage.factory'
import { prisma } from '@/lib/prisma'
import { getPiNetworkApiKey, isPiSandboxMode } from '@/lib/pi/pi-api-key'

export const runtime = 'nodejs'

export async function GET() {
  const start = Date.now()

  try {
    // اختبار اتصال قاعدة البيانات
    await prisma.$queryRaw`SELECT 1`
    const dbLatency = Date.now() - start

    return NextResponse.json({
      status:    'ok',
      timestamp: new Date().toISOString(),
      version:   process.env.npm_package_version ?? '0.1.0',
      services: {
        database: { status: 'ok', latencyMs: dbLatency },
        storage:  {
          provider: getStorageProvider(),
          r2Missing: getStorageProvider() === 'r2' ? getMissingR2EnvVars() : [],
        },
        deepface: { status: process.env.DEEPFACE_SERVICE_URL ? 'configured' : 'fallback-local' },
        piNetwork: {
          mode:      isPiSandboxMode() ? 'sandbox' : 'live',
          payments:  getPiNetworkApiKey() ? 'configured' : 'missing_key',
        },
        sentry: {
          status: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
            ? 'configured'
            : 'disabled',
        },
      },
    })
  } catch (err) {
    return NextResponse.json({
      status:    'error',
      timestamp: new Date().toISOString(),
      error:     err instanceof Error ? err.message : 'Unknown error',
    }, { status: 503 })
  }
}
