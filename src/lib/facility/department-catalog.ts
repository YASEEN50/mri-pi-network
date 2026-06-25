export interface DepartmentTemplate {
  code: string
  name: string
  nameEn: string
  icon: string
  sortOrder: number
}

/** Default hospital departments — seeded per facility on request */
export const DEFAULT_HOSPITAL_DEPARTMENTS: DepartmentTemplate[] = [
  { code: 'EMERGENCY', name: 'الطوارئ', nameEn: 'Emergency', icon: '🚨', sortOrder: 1 },
  { code: 'INTERNAL', name: 'الباطنة', nameEn: 'Internal Medicine', icon: '🩺', sortOrder: 2 },
  { code: 'SURGERY', name: 'الجراحة', nameEn: 'Surgery', icon: '🔪', sortOrder: 3 },
  { code: 'PEDIATRICS', name: 'الأطفال', nameEn: 'Pediatrics', icon: '👶', sortOrder: 4 },
  { code: 'OBGYN', name: 'النساء والتوليد', nameEn: 'OB/GYN', icon: '🤰', sortOrder: 5 },
  { code: 'CARDIOLOGY', name: 'القلب', nameEn: 'Cardiology', icon: '❤️', sortOrder: 6 },
  { code: 'ORTHOPEDICS', name: 'العظام', nameEn: 'Orthopedics', icon: '🦴', sortOrder: 7 },
  { code: 'RADIOLOGY', name: 'الأشعة', nameEn: 'Radiology', icon: '📡', sortOrder: 8 },
  { code: 'LABORATORY', name: 'المختبر', nameEn: 'Laboratory', icon: '🔬', sortOrder: 9 },
  { code: 'ICU', name: 'العناية المركزة', nameEn: 'ICU', icon: '🏥', sortOrder: 10 },
  { code: 'ENT', name: 'الأنف والأذن', nameEn: 'ENT', icon: '👂', sortOrder: 11 },
  { code: 'OPHTHALMOLOGY', name: 'العيون', nameEn: 'Ophthalmology', icon: '👁️', sortOrder: 12 },
  { code: 'DERMATOLOGY', name: 'الجلدية', nameEn: 'Dermatology', icon: '🧴', sortOrder: 13 },
  { code: 'PSYCHIATRY', name: 'الطب النفسي', nameEn: 'Psychiatry', icon: '🧠', sortOrder: 14 },
  { code: 'DENTISTRY', name: 'الأسنان', nameEn: 'Dentistry', icon: '🦷', sortOrder: 15 },
]

export const ON_CALL_SHIFT_LABELS: Record<string, { ar: string; en: string }> = {
  MORNING: { ar: 'صباحي', en: 'Morning' },
  EVENING: { ar: 'مسائي', en: 'Evening' },
  NIGHT: { ar: 'ليلي', en: 'Night' },
  FULL_DAY: { ar: '24 ساعة', en: '24 hours' },
}
