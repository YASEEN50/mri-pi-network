import { NextRequest, NextResponse } from 'next/server'
import { requireEnv } from '@/lib/env'
import { runHealthDataRetention } from '@/lib/retention/health-data-retention'
import { retentionPolicySummary } from '@/lib/retention/config'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${requireEnv('CRON_SECRET')}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runHealthDataRetention()
    console.log('[Cron/HealthRetention]', result)
    return NextResponse.json({ success: true, policy: retentionPolicySummary(), ...result })
  } catch (err) {
    console.error('[Cron/HealthRetention] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
