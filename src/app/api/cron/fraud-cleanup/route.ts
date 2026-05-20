// src/app/api/cron/fraud-cleanup/route.ts
// تنظيف سجلات Fraud Intelligence القديمة — يُشغَّل يومياً

import { NextRequest, NextResponse } from 'next/server'
import { cleanupOldIntelligence }    from '@/lib/fraud-intelligence'
import { requireEnv }                from '@/lib/env'

export const runtime     = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${requireEnv('CRON_SECRET')}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await cleanupOldIntelligence(30)
    console.log('[Cron/FraudCleanup]', result)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[Cron/FraudCleanup] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
