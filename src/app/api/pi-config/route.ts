import { NextResponse } from 'next/server'
import { getPiRouteMap } from '@/lib/pi/pi-routes'
import { isPiSandboxMode } from '@/lib/pi/pi-api-key'

export const runtime = 'edge'

export async function GET() {
  return NextResponse.json({
    sandbox: isPiSandboxMode(),
    /** Post-login: use Next.js app routes (not pi-*.html shell duplicates) */
    appShell: 'nextjs',
    routes: getPiRouteMap(),
  })
}
