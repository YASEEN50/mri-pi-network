// src/i18n/config.ts
export const locales = ['ar', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'ar'

// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export default getRequestConfig(async () => {
  const cookieStore = cookies()
  const locale = (cookieStore.get('locale')?.value ?? 'ar') as 'ar' | 'en'
  const validLocale = ['ar', 'en'].includes(locale) ? locale : 'ar'

  return {
    locale: validLocale,
    messages: (await import(`../messages/${validLocale}.json`)).default,
  }
})
