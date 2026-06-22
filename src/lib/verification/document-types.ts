// src/lib/verification/document-types.ts
/** أنواع وثائق التحقق المطلوبة من الطبيب */

export const DOC_TYPES = {
  CREDENTIAL:  'CREDENTIAL',
  LICENSE:     'LICENSE',
  DATAFLOW:    'DATAFLOW',
  ID_DOCUMENT: 'ID_DOCUMENT',
  SELFIE:      'SELFIE',
} as const

export type VerificationDocType = typeof DOC_TYPES[keyof typeof DOC_TYPES]

export const DEGREE_TYPES = {
  BACHELOR:   'BACHELOR',
  MASTER:     'MASTER',
  FELLOWSHIP: 'FELLOWSHIP',
} as const

export type DegreeType = typeof DEGREE_TYPES[keyof typeof DEGREE_TYPES]

export const DEGREE_TYPE_LABELS: Record<DegreeType, string> = {
  BACHELOR:   'بكالوريوس (Bachelor)',
  MASTER:     'ماجستير (Master)',
  FELLOWSHIP: 'زمالة / البورد (Fellowship)',
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  CREDENTIAL:  '🎓 الشهادة الجامعية',
  LICENSE:     '📋 شهادة مزاولة المهنة',
  DATAFLOW:    '📊 نتيجة Dataflow',
  ID_DOCUMENT: '🪪 الهوية (اسم مطابق للشهادة)',
  SELFIE:      '🤳 صورة سيلفي (مطابقة للهوية)',
}

/** ترتيب رفع الوثائق الإلزامية */
export const UPLOAD_STAGES = [
  { key: 'degree',    docType: DOC_TYPES.CREDENTIAL,  label: 'الشهادة الجامعية',      icon: '🎓' },
  { key: 'license',   docType: DOC_TYPES.LICENSE,     label: 'مزاولة المهنة',         icon: '📋' },
  { key: 'dataflow',  docType: DOC_TYPES.DATAFLOW,    label: 'نتيجة Dataflow',        icon: '📊' },
  { key: 'identity',  docType: DOC_TYPES.ID_DOCUMENT, label: 'الهوية',                icon: '🪪' },
  { key: 'selfie',    docType: DOC_TYPES.SELFIE,      label: 'صورة سيلفي',            icon: '🤳' },
  { key: 'submitted', docType: '',                    label: 'قيد المراجعة',          icon: '✅' },
] as const

export type UploadStageKey = typeof UPLOAD_STAGES[number]['key']

export function computeUploadStage(
  documents: { docType: string }[],
  sessionState?: string,
): UploadStageKey {
  if (['PENDING_HUMAN', 'ADMIN_REVIEW', 'APPROVED', 'REJECTED', 'FACE_SUBMITTED', 'FRAUD_CHECK', 'SCORING'].includes(sessionState ?? '')) {
    if (documents.some(d => d.docType === DOC_TYPES.SELFIE)) return 'submitted'
  }
  if (!documents.some(d => d.docType === DOC_TYPES.CREDENTIAL))  return 'degree'
  if (!documents.some(d => d.docType === DOC_TYPES.LICENSE))     return 'license'
  if (!documents.some(d => d.docType === DOC_TYPES.DATAFLOW))    return 'dataflow'
  if (!documents.some(d => d.docType === DOC_TYPES.ID_DOCUMENT)) return 'identity'
  if (!documents.some(d => d.docType === DOC_TYPES.SELFIE))      return 'selfie'
  return 'submitted'
}
