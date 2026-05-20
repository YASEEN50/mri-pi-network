'use client'
// src/app/appointments/[id]/rating/page.tsx
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState, useCallback } from 'react'
import Navbar from '@/components/common/Navbar'
import ReviewForm from '@/components/reviews/ReviewForm'

export default function AppointmentRatingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const appointmentId = params.id as string

  const [doctorId,   setDoctorId]   = useState<string | null>(null)
  const [canReview,  setCanReview]  = useState(false)
  const [isLoading,  setIsLoading]  = useState(true)
  const [error,      setError]      = useState('')

  const loadAppointment = useCallback(async () => {
    try {
      // جلب هذا الموعد تحديداً
      const res  = await fetch(`/api/appointments?limit=100`)
      const data = await res.json()
      const apt  = (data.data ?? []).find((a: any) => a.id === appointmentId)

      if (!apt) { setError('الموعد غير موجود'); return }
      if (apt.status !== 'COMPLETED') { setError('يمكن التقييم فقط للمواعيد المكتملة'); return }
      if (apt.doctorId) {
        setDoctorId(apt.doctorId)
        setCanReview(true)
      } else {
        setError('لا يوجد طبيب مرتبط بهذا الموعد')
      }
    } catch {
      setError('حدث خطأ في تحميل الموعد')
    } finally {
      setIsLoading(false)
    }
  }, [appointmentId])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (!session) return
    void loadAppointment()
  }, [session, status, router, loadAppointment])

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⭐</div>
          <h1 className="text-2xl font-bold text-white">تقييم الموعد</h1>
          <p className="text-slate-400 text-sm mt-2">شاركنا تجربتك لمساعدة الآخرين</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
          {error ? (
            <div className="text-center py-4">
              <p className="text-amber-400 text-sm">{error}</p>
              <button onClick={() => router.back()} className="mt-4 text-slate-400 hover:text-white text-sm transition-colors">
                ← رجوع
              </button>
            </div>
          ) : canReview && doctorId ? (
            <ReviewForm
              doctorId={doctorId}
              appointmentId={appointmentId}
              onSuccess={() => router.push('/dashboard/client/appointments')}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
