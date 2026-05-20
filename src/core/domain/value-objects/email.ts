// =============================================================================
// src/core/domain/value-objects/email.ts
// =============================================================================

import { ValidationError } from '@/core/errors'

export class Email {
  private readonly _value: string

  private constructor(value: string) {
    this._value = value
  }

  static create(raw: string): Email {
    const trimmed = raw.trim().toLowerCase()
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!regex.test(trimmed)) {
      throw new ValidationError('البريد الإلكتروني غير صالح', { email: [trimmed] })
    }
    return new Email(trimmed)
  }

  get value(): string {
    return this._value
  }

  equals(other: Email): boolean {
    return this._value === other._value
  }

  toString(): string {
    return this._value
  }
}
