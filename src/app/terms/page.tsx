import LegalPageLayout from '@/components/layout/LegalPageLayout'
import { getLocale } from 'next-intl/server'

export default async function TermsPage() {
  const locale = await getLocale() as 'ar' | 'en'
  const isAr = locale === 'ar'

  return (
    <LegalPageLayout
      locale={locale}
      title={isAr ? 'الشروط والأحكام' : 'Terms of Service'}
      subtitle={isAr ? 'يرجى قراءة هذه الشروط قبل استخدام المنصة' : 'Please read these terms before using the platform'}
    >
      {isAr ? (
        <>
          <h2>1. قبول الشروط</h2>
          <p>باستخدامك لمنصة MRI، فإنك توافق على الالتزام بهذه الشروط وسياسة الخصوصية.</p>
          <h2>2. استخدام المنصة</h2>
          <p>المنصة مخصصة للأغراض الطبية والاستشارية المشروعة. يُمنع نشر محتوى مضلل أو انتحال الهوية.</p>
          <h2>3. حسابات المستخدمين</h2>
          <p>أنت مسؤول عن سرية بيانات الدخول وعن جميع الأنشطة التي تتم عبر حسابك.</p>
          <h2>4. المواعيد والمدفوعات</h2>
          <p>سياسات الإلغاء والدفع تخضع لإعدادات الطبيب أو المنشأة المعنية.</p>
          <h2>5. التعديلات</h2>
          <p>قد نحدّث هذه الشروط periodically. استمرارك في الاستخدام يعني موافقتك على النسخة المحدّثة.</p>
        </>
      ) : (
        <>
          <h2>1. Acceptance</h2>
          <p>By using MRI, you agree to these terms and our privacy policy.</p>
          <h2>2. Platform Use</h2>
          <p>The platform is for legitimate medical and consultation purposes. Misleading content or impersonation is prohibited.</p>
          <h2>3. User Accounts</h2>
          <p>You are responsible for keeping your credentials secure and for all activity under your account.</p>
        </>
      )}
    </LegalPageLayout>
  )
}
