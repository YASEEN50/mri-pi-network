'use client'
// src/app/admin/doctors/page.tsx

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/common/Navbar'

interface PendingDoctor {
  id: string
  fullName: string
  specialization: string
  licenseNumber: string
  credentialsCount: number
  city?: string
  country: string
  approvalStatus: string
}

export default function AdminDoctorsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [doctors, setDoctors] = useState<PendingDoctor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'DOCUMENTS_REVIEW' | 'APPROVED' | 'REJECTED'>('DOCUMENTS_REVIEW')

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && !['ADMIN', 'OWNER'].includes(session.user.role)) { router.push('/'); return }
    if (session) loadDoctors()
  }, [session, status, filter, router])

  async function loadDoctors() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/doctors/pending')
      const data = await res.json()
      setDoctors(data.data ?? [])
    } catch {}
    finally { setIsLoading(false) }
  }

  async function handleAction(doctorId: string, action: 'approve' | 'reject', notes?: string) {
    const res = await fetch(`/api/admin/doctors/${doctorId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes }),
    })
    if (res.ok) {
      setDoctors(prev => prev.filter(d => d.id !== doctorId))
    }
  }

  const statusBadge: Record<string, string> = {
    DOCUMENTS_REVIEW: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    APPROVED:         'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    REJECTED:         'bg-red-500/10 text-red-400 border-red-500/20',
    PENDING:          'bg-slate-500/10 text-slate-400 border-slate-500/20',
  }

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin" className="text-slate-400 hover:text-white text-sm mb-2 inline-block">
              ← لوحة التحكم
            </Link>
            <h1 className="text-2xl font-bold text-white">مراجعة طلبات الأطباء</h1>
            <p className="text-slate-400 text-sm mt-1">{doctors.length} طلب بانتظار المراجعة</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : doctors.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-slate-400">لا توجد طلبات بانتظار المراجعة</p>
          </div>
        ) : (
          <div className="space-y-4">
            {doctors.map((doctor) => (
              <div key={doctor.id}
                className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-lg flex-shrink-0">
                      {doctor.fullName[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-white">{doctor.fullName}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${statusBadge[doctor.approvalStatus] ?? ''}`}>
                          قيد المراجعة
                        </span>
                      </div>
                      <p className="text-emerald-400 text-sm">{doctor.specialization}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>رخصة: {doctor.licenseNumber}</span>
                        <span>•</span>
                        <span>{doctor.credentialsCount} شهادات</span>
                        {doctor.city && <><span>•</span><span>📍 {doctor.city}</span></>}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Link href={`/admin/doctors/${doctor.id}/verify`}
                      className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-medium transition-all">
                      عرض المستندات
                    </Link>
                    <button onClick={() => handleAction(doctor.id, 'approve')}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-medium transition-all">
                      ✓ موافقة
                    </button>
                    <button onClick={() => {
                      const notes = prompt('سبب الرفض:')
                      if (notes) handleAction(doctor.id, 'reject', notes)
                    }}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs transition-all">
                      ✗ رفض
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
