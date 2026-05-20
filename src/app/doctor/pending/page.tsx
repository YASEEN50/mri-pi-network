'use client'
// src/app/doctor/pending/page.tsx
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'

export default function DoctorPendingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [verifyStatus, setVerifyStatus] = useState<string>('UNVERIFIED')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') {
      if (session?.user?.role !== 'DOCTOR') { router.push('/'); return }
      if (session?.user?.approvalStatus === 'APPROVED') { router.push('/dashboard/doctor/schedule'); return }

      // جلب حالة التحقق
      fetch('/api/doctor/verification-status')
        .then(r => r.json())
        .then(d => {
          if (d.data?.verificationStatus) setVerifyStatus(d.data.verificationStatus)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [status, session, router])

  if (status === 'loading' || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#080c14'}}>
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  const isRejected    = session?.user?.approvalStatus === 'REJECTED'
  const hasUploaded   = ['AI_APPROVED','ADMIN_REVIEW','APPROVED','REJECTED_BY_ADMIN'].includes(verifyStatus)
  const isUnverified  = verifyStatus === 'UNVERIFIED'

  return (
    <div className="min-h-screen" style={{background:'#080c14'}} dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-lg mx-auto px-4 py-16">

        {/* مرفوض */}
        {isRejected ? (
          <div className="rounded-2xl p-8 text-center" style={{background:'rgba(239,68,68,0.05)',border:'1px solid rgba(239,68,68,0.15)'}}>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-white mb-3">تم رفض طلبك</h1>
            <p className="text-slate-400 mb-6 leading-relaxed text-sm">
              للأسف، تم رفض طلب تسجيلك. يرجى مراجعة المستندات المطلوبة وإعادة التقديم.
            </p>
            <Link href="/onboarding/doctor"
              className="inline-block px-6 py-3 rounded-xl text-white font-medium text-sm transition-all"
              style={{background:'linear-gradient(135deg,#10b981,#0891b2)'}}>
              إعادة التقديم
            </Link>
          </div>

        ) : (
          <div className="space-y-4">

            {/* Header */}
            <div className="text-center mb-8">
              <div className="text-5xl mb-3">{hasUploaded ? '⏳' : '📋'}</div>
              <h1 className="text-2xl font-bold text-white mb-2">
                {hasUploaded ? 'طلبك قيد المراجعة' : 'مرحباً بك في المنصة الطبية'}
              </h1>
              <p className="text-slate-400 text-sm">
                {hasUploaded
                  ? 'يراجع فريقنا مستنداتك وسيتم إشعارك بالنتيجة'
                  : 'تم إنشاء حسابك بنجاح — الخطوة التالية رفع مستندات التحقق'
                }
              </p>
            </div>

            {/* حالة التقدم */}
            <div className="rounded-2xl p-5 space-y-3" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
              <h3 className="text-white font-semibold text-sm mb-3">حالة طلبك</h3>
              {[
                { label: 'إنشاء الحساب',       done: true,        icon: '✅' },
                { label: 'إكمال البيانات الأساسية', done: true,   icon: '✅' },
                { label: 'رفع مستندات التحقق', done: hasUploaded, icon: hasUploaded ? '✅' : '⏳' },
                { label: 'المراجعة البشرية',   done: false,       icon: '👨‍💼' },
                { label: 'الاعتماد والتفعيل',  done: false,       icon: '🏆' },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{step.icon}</span>
                  <p className={`text-sm ${step.done ? 'text-white' : 'text-slate-500'}`}>{step.label}</p>
                  {step.done && <span className="mr-auto text-xs px-2 py-0.5 rounded-full" style={{background:'rgba(16,185,129,0.15)',color:'#34d399'}}>مكتمل</span>}
                </div>
              ))}
            </div>

            {/* زر رفع المستندات — يظهر فقط إذا لم يرفع بعد */}
            {isUnverified && (
              <div className="rounded-2xl p-5" style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.25)'}}>
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="text-amber-400 font-semibold text-sm">مطلوب: رفع مستندات التحقق</p>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                      لا يمكن تفعيل حسابك بدون التحقق من هويتك ورخصة مزاولتك.
                      هذا ضروري لحماية سلامة المرضى.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {[
                    '📋 صورة رخصة مزاولة المهنة',
                    '🎓 صور الشهادات العلمية',
                    '🪪 صورة شخصية + صورة هوية رسمية',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>

                <Link href="/doctor/verify"
                  className="block w-full py-3.5 rounded-xl text-center text-white font-semibold text-sm transition-all"
                  style={{background:'linear-gradient(135deg,#f59e0b,#ef4444)'}}>
                  🔐 رفع مستندات التحقق الآن
                </Link>
              </div>
            )}

            {/* إذا رفع المستندات */}
            {hasUploaded && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 rounded-xl"
                  style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.15)'}}>
                  <span className="text-xl">✅</span>
                  <div>
                    <p className="text-emerald-400 text-sm font-medium">تم استلام مستنداتك</p>
                    <p className="text-slate-400 text-xs mt-0.5">رخصة المزاولة، الشهادات، وصور التحقق من الهوية</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl"
                  style={{background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.15)'}}>
                  <span className="text-xl">👨‍💼</span>
                  <div>
                    <p className="text-blue-400 text-sm font-medium">مراجعة بشرية إلزامية جارية</p>
                    <p className="text-slate-400 text-xs mt-0.5">يراجع فريقنا المتخصص كل مستند للتحقق من صحته وهويتك</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl"
                  style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.15)'}}>
                  <span className="text-xl">⏱</span>
                  <div>
                    <p className="text-amber-400 text-sm font-medium">المدة المتوقعة: 1-3 أيام عمل</p>
                    <p className="text-slate-400 text-xs mt-0.5">ستصلك إشعار فور اتخاذ القرار</p>
                  </div>
                </div>
              </div>
            )}

            <Link href="/" className="block text-center text-sm text-slate-500 hover:text-white transition-colors mt-4">
              العودة للصفحة الرئيسية
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
