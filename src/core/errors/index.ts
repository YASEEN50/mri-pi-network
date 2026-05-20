// src/core/errors/index.ts

export abstract class AppError extends Error {
  abstract readonly code: string
  abstract readonly statusCode: number
  constructor(message: string, public readonly context?: Record<string, unknown>) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
  toJSON() { return { code: this.code, message: this.message, context: this.context } }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR'; readonly statusCode = 400
  constructor(message: string, public readonly fields?: Record<string, string[]>) { super(message) }
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND'; readonly statusCode = 404
  constructor(resource: string, identifier?: string) {
    super(
      identifier ? `${resource} بالمعرف "${identifier}" غير موجود` : `${resource} غير موجود`,
      { resource, identifier }
    )
  }
}

export class UnauthorizedError extends AppError {
  readonly code = 'UNAUTHORIZED'; readonly statusCode = 401
  constructor(message = 'غير مصرح لك بهذا الإجراء') { super(message) }
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN'; readonly statusCode = 403
  constructor(message = 'لا تملك الصلاحية الكافية') { super(message) }
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT'; readonly statusCode = 409
  constructor(message: string, context?: Record<string, unknown>) { super(message, context) }
}

export class BusinessRuleError extends AppError {
  readonly code = 'BUSINESS_RULE_VIOLATION'; readonly statusCode = 422
  constructor(message: string, context?: Record<string, unknown>) { super(message, context) }
}

export class InternalError extends AppError {
  readonly code = 'INTERNAL_ERROR'; readonly statusCode = 500
  constructor(message = 'حدث خطأ داخلي في النظام', public readonly cause?: unknown) { super(message) }
}

export class StorageError extends AppError {
  readonly code = 'STORAGE_ERROR'; readonly statusCode = 500
  constructor(message = 'فشل رفع الملف') { super(message) }
}

export type Result<T, E extends AppError = AppError> =
  | { success: true; data: T }
  | { success: false; error: E }

export function success<T>(data: T): Result<T, never> { return { success: true, data } }
export function failure<E extends AppError>(error: E): Result<never, E> { return { success: false, error } }
export function isSuccess<T, E extends AppError>(result: Result<T, E>): result is { success: true; data: T } { return result.success === true }
export function isFailure<T, E extends AppError>(result: Result<T, E>): result is { success: false; error: E } { return result.success === false }
export function unwrap<T, E extends AppError>(result: Result<T, E>): T {
  if (isSuccess(result)) return result.data
  throw result.error
}

