import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { fromAppError, serverError } from '@/lib/api-response'
import { buildUserDataExport } from '@/lib/privacy/export-user-data'
import { exportFilename, toExportJson } from '@/lib/privacy/json-export'
import { AppError, BusinessRuleError } from '@/core/errors'

export async function GET(_req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const payload = await buildUserDataExport(auth.context.userId, auth.context.role)
    const body = toExportJson(payload)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportFilename(auth.context.userId)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    if (err instanceof AppError) return fromAppError(err)
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      return fromAppError(new BusinessRuleError('الحساب غير موجود'))
    }
    console.error('[GET /api/account/export]', err)
    return serverError()
  }
}
