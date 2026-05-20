'use client'
// src/app/verify-email/page.tsx
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function VerifyEmailPage() {
  const params  = useSearchParams()
  const success = params.get('success') === 'true'
  const error   = params.get('error')

  if (success) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4" dir="rtl">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-white mb-2">تم تأكيد بريدك الإلكتروني!</h1>
        <p className="text-slate-400 mb-6 text-sm">يمكنك الآن تسجيل الدخول والاستمتاع بكامل خدمات المنصة.</p>
        <Link href="/login"
          className="inline-block px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold text-sm transition-all hover:from-emerald-400 hover:to-teal-500">
          تسجيل الدخول
        </Link>
      </div>
    </div>
  )

  const errorMessages: Record<string, string> = {
    invalid: 'رابط التحقق غير صحيح أو منتهي الصلاحية.',
    expired: 'انتهت صلاحية رابط التحقق. يرجى طلب رابط جديد.',
    server:  'حدث خطأ في الخادم. يرجى المحاولة لاحقاً.',
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4" dir="rtl">
      <div className="text-center max-w-md">
        {error ? (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-white mb-2">فشل التحقق</h1>
            <p className="text-slate-400 mb-6 text-sm">{errorMessages[error] ?? 'حدث خطأ غير متوقع.'}</p>
            <div className="flex gap-3 justify-center">
              <Link href="/login"
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-all">
                تسجيل الدخول
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">📧</div>
            <h1 className="text-2xl font-bold text-white mb-2">تحقق من بريدك الإلكتروني</h1>
            <p className="text-slate-400 mb-2 text-sm">تم إرسال رابط التأكيد إلى بريدك الإلكتروني.</p>
            <p className="text-slate-500 text-xs">إذا لم يصلك البريد، تحقق من مجلد Spam.</p>
          </>
        )}
      </div>
    </div>
  )
}
