// src/app/api/cron/reminders/route.ts
// يُستدعى كل 5 دقائق من Vercel Cron
// vercel.json: { "crons": [{ "path": "/api/cron/reminders", "schedule": "*/5 * * * *" }] }

import { NextRequest, NextResponse } from 'next/server'
import { processDueReminders } from '@/lib/cron/reminders.service'
import { requireEnv } from '@/lib/env'

export async function GET(req: NextRequest) {
  // حماية: يجب أن يأتي الطلب من Vercel Cron أو بـ secret
  const authHeader = req.headers.get('authorization')
  const secret     = requireEnv('CRON_SECRET')

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processDueReminders()
    console.log('[Cron/Reminders]', result)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[Cron/Reminders] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
