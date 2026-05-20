// =============================================================================
// src/core/domain/value-objects/license-number.ts
// =============================================================================

import { ValidationError } from '@/core/errors'

export class LicenseNumber {
  private readonly _value: string

  private constructor(value: string) {
    this._value = value
  }

  // قبول أي تنسيق غير فارغ، مع تطبيع المسافات
  static create(raw: string): LicenseNumber {
    const trimmed = raw.trim().toUpperCase()
    if (!trimmed || trimmed.length < 3) {
      throw new ValidationError('رقم الرخصة غير صالح — يجب أن يكون 3 أحرف على الأقل')
    }
    if (trimmed.length > 50) {
      throw new ValidationError('رقم الرخصة طويل جداً')
    }
    return new LicenseNumber(trimmed)
  }

  get value(): string {
    return this._value
  }

  equals(other: LicenseNumber): boolean {
    return this._value === other._value
  }

  toString(): string {
    return this._value
  }
}

// =============================================================================
// src/core/domain/value-objects/medical-degree.ts
// =============================================================================

export type DegreeLevel = 'BACHELOR' | 'MASTER' | 'PHD' | 'FELLOWSHIP' | 'DIPLOMA' | 'CERTIFICATE'

export interface MedicalDegreeProps {
  title: string
  institution: string
  country: string
  year: number
  level: DegreeLevel
  documentUrl: string
}

export class MedicalDegree {
  private constructor(private readonly props: MedicalDegreeProps) {}

  static create(props: MedicalDegreeProps): MedicalDegree {
    const currentYear = new Date().getFullYear()

    if (!props.title.trim()) {
      throw new ValidationError('اسم الشهادة مطلوب')
    }
    if (!props.institution.trim()) {
      throw new ValidationError('اسم المؤسسة التعليمية مطلوب')
    }
    if (props.year < 1950 || props.year > currentYear) {
      throw new ValidationError(`سنة الشهادة يجب أن تكون بين 1950 و ${currentYear}`)
    }
    if (!props.documentUrl.trim()) {
      throw new ValidationError('صورة الشهادة مطلوبة')
    }

    return new MedicalDegree({
      ...props,
      title: props.title.trim(),
      institution: props.institution.trim(),
    })
  }

  get title(): string { return this.props.title }
  get institution(): string { return this.props.institution }
  get country(): string { return this.props.country }
  get year(): number { return this.props.year }
  get level(): DegreeLevel { return this.props.level }
  get documentUrl(): string { return this.props.documentUrl }

  toPlainObject(): MedicalDegreeProps {
    return { ...this.props }
  }
}
