import { getLocale } from 'next-intl/server'
import DoctorsMapPageClient from './DoctorsMapPageClient'

export default async function DoctorsMapPage() {
  const locale = await getLocale() as 'ar' | 'en'
  return <DoctorsMapPageClient locale={locale} />
}
