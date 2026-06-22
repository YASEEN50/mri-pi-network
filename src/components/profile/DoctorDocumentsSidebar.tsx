'use client'
// src/components/profile/DoctorDocumentsSidebar.tsx
// الشريط الجانبي لرفع الوثائق في الملف الشخصي

import DoctorDocumentUploadFlow from '@/components/doctor/DoctorDocumentUploadFlow'

export default function DoctorDocumentsSidebar({
  approvalStatus,
}: {
  approvalStatus?: string
}) {
  const needsUpload = approvalStatus !== 'APPROVED'

  return (
    <aside className="lg:w-[380px] w-full shrink-0 lg:sticky lg:top-24 self-start">
      <div className="mpi-card rounded-2xl p-5 border border-primary/20">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">📄</span>
          <h2 className="text-white font-bold text-sm">الوثائق والشهادات</h2>
        </div>
        {needsUpload && (
          <p className="text-slate-400 text-xs mb-4 leading-relaxed">
            بعد إنشاء الحساب، ارفع المستندات الخمسة المطلوبة للاعتماد.
          </p>
        )}
        <DoctorDocumentUploadFlow variant="sidebar" approvalStatus={approvalStatus} />
      </div>
    </aside>
  )
}
