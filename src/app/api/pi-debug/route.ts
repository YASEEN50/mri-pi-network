import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Debug: open /api/pi-debug in Pi Browser to see detected User-Agent */
export async function GET(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? 'unknown'
  return new NextResponse(
    `MRI Pi Debug\nUser-Agent: ${ua}\nTime: ${new Date().toISOString()}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  )
}
