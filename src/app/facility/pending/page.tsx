'use client'
// src/app/facility/pending/page.tsx

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'

export default function FacilityPendingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session?.user?.role !== 'FACILITY') { router.push('/'); return }
    if (session?.user?.approvalStatus === 'APPROVED') {
      router.push('/dashboard/facility/doctors'); return
    }
  }, [session, status, router])

  const isRejected = session?.user?.approvalStatus === 'REJECTED'

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-10">
          {isRejected ? (
            <>
              <div className="text-5xl mb-4">❌</div>
              <h1 className="text-2xl font-bold text-white mb-3">تم رفض طلبك</h1>
              <p className="text-slate-400 mb-6 leading-relaxed">
                للأسف، تم رفض طلب تسجيل منشأتك. يرجى مراجعة المستندات المطلوبة وإعادة التقديم.
              </p>
              <Link href="/onboarding/facility"
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-medium transition-all">
                إعادة التقديم
              </Link>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4">⏳</div>
              <h1 className="text-2xl font-bold text-white mb-3">منشأتك قيد المراجعة</h1>
              <p className="text-slate-400 mb-6 leading-relaxed">
                شكراً لتسجيل منشأتك! يقوم فريقنا حالياً بمراجعة المستندات والترخيص.
                سيتم إعلامك فور اتخاذ القرار.
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-right">
                  <span className="text-2xl">📋</span>
                  <div>
                    <p className="text-amber-400 font-medium text-sm">ماذا يحدث الآن؟</p>
                    <p className="text-slate-400 text-xs mt-0.5">يراجع فريقنا ترخيص منشأتك ومستنداتها</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-right">
                  <span className="text-2xl">⏱</span>
                  <div>
                    <p className="text-blue-400 font-medium text-sm">المدة المتوقعة</p>
                    <p className="text-slate-400 text-xs mt-0.5">عادةً خلال 1-3 أيام عمل</p>
                  </div>
                </div>
              </div>
              <Link href="/" className="inline-block mt-6 text-sm text-slate-400 hover:text-white transition-colors">
                العودة للصفحة الرئيسية
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
