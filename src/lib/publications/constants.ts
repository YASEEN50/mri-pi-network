export const PUBLICATION_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  ARTICLE: { ar: 'مقال', en: 'Article' },
  RESEARCH: { ar: 'بحث', en: 'Research' },
  CASE_STUDY: { ar: 'دراسة حالة', en: 'Case study' },
  ANNOUNCEMENT: { ar: 'إعلان', en: 'Announcement' },
  TIP: { ar: 'نصيحة طبية', en: 'Medical tip' },
}

export const PUBLICATION_TYPE_COLORS: Record<string, string> = {
  ARTICLE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  RESEARCH: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  CASE_STUDY: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  ANNOUNCEMENT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  TIP: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

export function publicationTypeLabel(type: string, locale: 'ar' | 'en'): string {
  return PUBLICATION_TYPE_LABELS[type]?.[locale] ?? type
}
