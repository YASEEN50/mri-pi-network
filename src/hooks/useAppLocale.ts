'use client'

import { useLocale } from 'next-intl'

export type AppLocale = 'ar' | 'en'

export function useAppLocale() {
  const locale = useLocale() as AppLocale
  const isRTL = locale === 'ar'
  return {
    locale,
    isRTL,
    dir: isRTL ? ('rtl' as const) : ('ltr' as const),
    dateLocale: isRTL ? 'ar-SA' : 'en-US',
  }
}
