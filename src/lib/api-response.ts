// =============================================================================
// src/lib/api-response.ts
// Standardized API response helpers
// =============================================================================

import { NextResponse } from 'next/server'
import { AppError } from '@/core/errors'
import { ZodError } from 'zod'

export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: Record<string, unknown>
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

// ---- Success Responses -------------------------------------------------------

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json<ApiSuccess<T>>(
    { success: true, data, ...(meta && { meta }) },
    { status }
  )
}

export function created<T>(data: T) {
  return ok(data, undefined, 201)
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}

// ---- Error Responses ---------------------------------------------------------

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json<ApiError>(
    { success: false, error: { code, message, ...(details && { details }) } },
    { status }
  )
}

export function fromAppError(err: AppError) {
  return apiError(err.code, err.message, err.statusCode, err.context)
}

export function fromZodError(err: ZodError) {
  return apiError(
    'VALIDATION_ERROR',
    'البيانات المدخلة غير صحيحة',
    400,
    err.flatten().fieldErrors
  )
}

export function serverError(message = 'حدث خطأ داخلي في الخادم') {
  return apiError('INTERNAL_ERROR', message, 500)
}

// ---- Parse & Validate Helper -------------------------------------------------

import { z } from 'zod'

export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown):
  | { success: true; data: T }
  | { success: false; response: NextResponse } {
  const result = schema.safeParse(body)
  if (!result.success) {
    return { success: false, response: fromZodError(result.error) }
  }
  return { success: true, data: result.data }
}

export function parseQuery<T>(schema: z.ZodSchema<T>, searchParams: URLSearchParams):
  | { success: true; data: T }
  | { success: false; response: NextResponse } {
  const raw: Record<string, string> = {}
  searchParams.forEach((value, key) => { raw[key] = value })
  const result = schema.safeParse(raw)
  if (!result.success) {
    return { success: false, response: fromZodError(result.error) }
  }
  return { success: true, data: result.data }
}
