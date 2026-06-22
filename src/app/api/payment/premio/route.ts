// src/app/api/payment/premio/route.ts
// الدفع القديم المباشر — مُعطّل. استخدم Pi SDK + /api/payment/pi/*

import { NextRequest } from 'next/server'
import { ok } from '@/lib/api-response'

export async function POST(_req: NextRequest) {
  return ok({
    error:   true,
    message: 'يجب الدفع بعملة Pi عبر Pi Browser. لا يمكن التفعيل بدون إتمام الدفع.',
  })
}
