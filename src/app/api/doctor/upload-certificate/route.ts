// src/app/api/doctor/upload-certificate/route.ts
// DEPRECATED: Use /api/doctor/upload-license instead
// This endpoint now redirects to the new secure server-side OCR flow

import { NextRequest } from 'next/server'
import { requireAuth }  from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError } from '@/lib/api-response'
import { Role }         from '@prisma/client'

export async function POST(req: NextRequest) {
  const auth = await requireAuth({ roles: [Role.DOCTOR] })
  if (!auth.success) return fromAppError(auth.error)

  // Client-side OCR is no longer accepted for security reasons.
  // Doctor must upload the actual file via /api/doctor/upload-license
  return ok({
    error:   true,
    message: 'يرجى استخدام نظام الرفع الجديد. ارفع صورة الرخصة مباشرة عبر نموذج الرفع.',
    redirect: '/api/doctor/upload-license',
  })
}
