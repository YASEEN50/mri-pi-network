'use client'

import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'
import ReviewForm from '@/components/reviews/ReviewForm'

interface ConsultDetail {
  id: string
  status: string
  doctorId: string | null
  doctor: string | null
  canReview: boolean
  hasReview: boolean
}

export default function InstantConsultRatingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const consultId = params.id as string

  const [consult, setConsult] = useState<ConsultDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadConsult = useCallback(async () => {
    try {
      const res = await fetch(`/api/instant-consult/${consultId}/rating`, { cache: 'no-store' })
      const data = await res.json()
      const item = data.data as ConsultDetail & { error?: boolean; message?: string }

      if (!res.ok || item?.error) {
        setError(item?.message ?? 'الاستشارة غير موجودة')
        return
      }

      setConsult(item)

      if (item.hasReview) {
        setError('لقد قمت بتقييم هذه الاستشارة مسبقاً')
        return
      }
      if (!item.canReview) {
        setError('يمكن التقييم فقط للاستشارات الفورية المكتملة مع طبيب')
      }
    } catch {
      setError('حدث خطأ في تحميل الاستشارة')
    } finally {
      setIsLoading(false)
    }
  }, [consultId])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (!session) return
    void loadConsult()
  }, [session, status, router, loadConsult])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⭐</div>
          <h1 className="text-2xl font-bold text-white">تقييم الاستشارة الفورية</h1>
          {consult?.doctor && (
            <p className="text-slate-300 text-sm mt-2">{consult.doctor}</p>
          )}
          <p className="text-slate-400 text-sm mt-1">شاركنا تجربتك لمساعدة الآخرين</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
          {error ? (
            <div className="text-center py-4">
              <p className="text-amber-400 text-sm">{error}</p>
              <Link
                href="/consult-now"
                className="mt-4 inline-block text-slate-400 hover:text-white text-sm transition-colors"
              >
                ← العودة للاستشارة الفورية
              </Link>
            </div>
          ) : consult?.canReview && consult.doctorId ? (
            <ReviewForm
              doctorId={consult.doctorId}
              instantConsultId={consultId}
              onSuccess={() => router.push('/consult-now')}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
