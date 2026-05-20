// =============================================================================
// src/core/domain/value-objects/phone-number.ts
// =============================================================================

import { ValidationError } from '@/core/errors'

export class PhoneNumber {
  private readonly _value: string
  private readonly _countryCode: string

  private constructor(value: string, countryCode: string) {
    this._value = value
    this._countryCode = countryCode
  }

  static create(raw: string, countryCode = 'SA'): PhoneNumber {
    const cleaned = raw.replace(/[\s\-\(\)]/g, '')

    // دعم الأرقام الدولية والمحلية
    const international = /^\+\d{7,15}$/
    const local = /^\d{9,15}$/

    if (!international.test(cleaned) && !local.test(cleaned)) {
      throw new ValidationError('رقم الهاتف غير صالح', { phone: [raw] })
    }

    // تطبيع الرقم السعودي
    let normalized = cleaned
    if (countryCode === 'SA' && cleaned.startsWith('05')) {
      normalized = '+966' + cleaned.slice(1)
    } else if (countryCode === 'SA' && cleaned.startsWith('5') && cleaned.length === 9) {
      normalized = '+966' + cleaned
    }

    return new PhoneNumber(normalized, countryCode)
  }

  get value(): string {
    return this._value
  }

  get countryCode(): string {
    return this._countryCode
  }

  equals(other: PhoneNumber): boolean {
    return this._value === other._value
  }

  toString(): string {
    return this._value
  }
}
