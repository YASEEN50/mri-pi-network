// GET — التحقق من رخصة سعودية (اختياري — يحتاج env)

import { NextRequest } from 'next/server'
import { requireAdminPermission, ADMIN_PERMISSION_KEYS } from '@/lib/admin/permissions'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import {
  isSaudiLicenseApiConfigured,
  verifySaudiMedicalLicense,
} from '@/lib/verification/saudi-license-api'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(ADMIN_PERMISSION_KEYS.canViewVerification)
    if (!auth.success) return fromAppError(auth.error)

    const licenseNumber = req.nextUrl.searchParams.get('licenseNumber')
    const holderName    = req.nextUrl.searchParams.get('holderName') ?? undefined

    if (!licenseNumber?.trim()) {
      return ok({ error: true, message: 'licenseNumber مطلوب' })
    }

    const result = await verifySaudiMedicalLicense({
      licenseNumber: licenseNumber.trim(),
      holderName,
    })

    return ok({
      configured: isSaudiLicenseApiConfigured(),
      result,
    })
  } catch (err) {
    console.error('[GET /api/admin/license-verify]', err)
    return serverError()
  }
}
