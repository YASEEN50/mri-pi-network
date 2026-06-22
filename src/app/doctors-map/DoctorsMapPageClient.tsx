'use client'

import dynamic from 'next/dynamic'
import Navbar from '@/components/common/Navbar'

const DoctorsMapView = dynamic(
  () => import('@/components/maps/DoctorsMapView'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[480px] text-slate-400">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    ),
  },
)

interface Props {
  locale: 'ar' | 'en'
}

export default function DoctorsMapPageClient({ locale }: Props) {
  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale={locale} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">خريطة الأطباء</h1>
          <p className="text-slate-400 text-sm mt-1">
            ابحث عن طبيب واضغط على العلامة لعرض التفاصيل — المواقع تقريبية حسب المدينة
          </p>
        </div>
        <DoctorsMapView />
      </div>
    </div>
  )
}
