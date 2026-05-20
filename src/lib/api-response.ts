import { NextResponse } from 'next/server'
import { AppError } from '@/core/errors'
import { ZodError } from 'zod'

export interface ApiMeta {
  total?: number; page?: number; limit?: number
  [key: string]: unknown
}

export function ok<T>(data: T, meta?: ApiMeta) {
  return NextResponse.json({ success: true, data, ...(meta && { meta }) }, { status: 200 })
}

export function created<T>(data: T) {
  return NextResponse.json({ success: true, data }, { status: 201 })
}

export function fromAppError(error: AppError) {
  return NextResponse.json(
    { success: false, error: { code: error.code, message: error.message } },
    { status: error.statusCode }
  )
}

export function serverError(message = 'حدث خطأ داخلي في النظام') {
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message } },
    { status: 500 }
  )
}

export function parseBody<T>(
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: ZodError } },
  body: unknown
): { success: true; data: T } | { success: false; response: ReturnType<typeof NextResponse.json> } {
  const result = schema.safeParse(body)
  if (!result.success || result.data === undefined) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة' } },
        { status: 400 }
      ),
    }
  }
  return { success: true, data: result.data }
}

export function fromZodError(error: ZodError) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', fields: error.flatten().fieldErrors } },
    { status: 400 }
  )
}
