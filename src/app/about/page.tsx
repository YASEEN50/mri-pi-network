import LegalPageLayout from '@/components/layout/LegalPageLayout'
import { getLocale } from 'next-intl/server'

export default async function AboutPage() {
  const locale = await getLocale() as 'ar' | 'en'
  const isAr = locale === 'ar'

  return (
    <LegalPageLayout
      locale={locale}
      title={isAr ? 'من نحن' : 'About Us'}
      subtitle={isAr ? 'منصة طبية موثوقة' : 'Trusted Medical Platform'}
    >
      {isAr ? (
        <>
          <h2>رؤيتنا</h2>
          <p>
            نربط المرضى بأطباء ومنشآت صحية معتمدة عبر منصة رقمية آمنة، مع التحقق الصارم من الهوية والمؤهلات
            لضمان سلامة كل تفاعل طبي.
          </p>
          <h2>ما نقدمه</h2>
          <ul>
            <li>حجز مواعيد مع أطباء موثّقين</li>
            <li>البحث عن منشآت طبية معتمدة</li>
            <li>نظام تحقق متعدد المراحل للأطباء والمنشآت</li>
            <li>منشورات ومحتوى طبي علمي</li>
          </ul>
          <h2>الثقة والأمان</h2>
          <p>
            كل طبيب ومنشأة يمر بعملية مراجعة بشرية قبل الظهور للجمهور. نستخدم التحقق من الهوية
            ومقارنة الوجه والوثائق الرسمية لحماية المرضى.
          </p>
        </>
      ) : (
        <>
          <h2>Our Vision</h2>
          <p>
            We connect patients with verified doctors and healthcare facilities through a secure digital platform,
            with strict identity and credential verification for every medical interaction.
          </p>
          <h2>What We Offer</h2>
          <ul>
            <li>Appointment booking with verified doctors</li>
            <li>Search for approved medical facilities</li>
            <li>Multi-stage verification for doctors and facilities</li>
            <li>Medical publications and scientific content</li>
          </ul>
        </>
      )}
    </LegalPageLayout>
  )
}
