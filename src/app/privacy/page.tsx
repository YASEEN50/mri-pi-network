import LegalPageLayout from '@/components/layout/LegalPageLayout'
import { getLocale } from 'next-intl/server'

export default async function PrivacyPage() {
  const locale = await getLocale() as 'ar' | 'en'
  const isAr = locale === 'ar'

  return (
    <LegalPageLayout
      locale={locale}
      title={isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
      subtitle={isAr ? 'كيف نجمع ونستخدم ونحمي بياناتك' : 'How we collect, use, and protect your data'}
    >
      {isAr ? (
        <>
          <h2>البيانات التي نجمعها</h2>
          <p>نجمع بيانات التسجيل (البريد، الاسم، الدور)، وبيانات المواعيد، ووثائق التحقق للأطباء والمنشآت.</p>
          <h2>استخدام البيانات</h2>
          <ul>
            <li>تقديم خدمات الحجز والتواصل</li>
            <li>التحقق من الهوية والمؤهلات</li>
            <li>تحسين تجربة المستخدم وأمان المنصة</li>
          </ul>
          <h2>حماية البيانات</h2>
          <p>نستخدم تشفيراً وصلاحيات وصول محدودة. وثائق التحقق تُستخدم لأغراض المراجعة فقط.</p>
          <h2>حقوقك</h2>
          <p>يمكنك طلب تصحيح أو حذف بياناتك عبر صفحة «اتصل بنا».</p>
        </>
      ) : (
        <>
          <h2>Data We Collect</h2>
          <p>We collect registration data, appointment information, and verification documents for doctors and facilities.</p>
          <h2>How We Use Data</h2>
          <ul>
            <li>Providing booking and communication services</li>
            <li>Identity and credential verification</li>
            <li>Improving user experience and platform security</li>
          </ul>
        </>
      )}
    </LegalPageLayout>
  )
}
