'use client'
// src/app/doctor/verify/page.tsx
// إعادة توجيه إلى الملف الشخصي — رفع الوثائق في الشريط الجانبي

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DoctorVerifyPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/profile')
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )
}
