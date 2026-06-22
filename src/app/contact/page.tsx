import LegalPageLayout from '@/components/layout/LegalPageLayout'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'

export default async function ContactPage() {
  const locale = await getLocale() as 'ar' | 'en'
  const isAr = locale === 'ar'

  return (
    <LegalPageLayout
      locale={locale}
      title={isAr ? 'اتصل بنا' : 'Contact Us'}
      subtitle={isAr ? 'نحن هنا لمساعدتك' : 'We are here to help'}
    >
      {isAr ? (
        <>
          <h2>الدعم الفني</h2>
          <p>
            للاستفسارات العامة أو مشاكل الحساب، راسلنا على:{' '}
            <a href="mailto:support@mri.app">support@mri.app</a>
          </p>
          <h2>التحقق والاعتماد</h2>
          <p>
            لاستفسارات الأطباء والمنشآت حول التحقق، راجع{' '}
            <Link href="/dashboard/admin/pending">الطلبات المعلقة</Link> إذا كنت مشرفاً.
          </p>
          <h2>وقت الاستجابة</h2>
          <p>نسعى للرد خلال 1–3 أيام عمل.</p>
        </>
      ) : (
        <>
          <h2>Technical Support</h2>
          <p>
            For general inquiries:{' '}
            <a href="mailto:support@mri.app">support@mri.app</a>
          </p>
          <h2>Response Time</h2>
          <p>We aim to respond within 1–3 business days.</p>
        </>
      )}
    </LegalPageLayout>
  )
}
