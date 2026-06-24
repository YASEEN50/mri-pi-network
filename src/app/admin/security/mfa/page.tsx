'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/common/Navbar'
import MfaSetupPanel from '@/components/mfa/MfaSetupPanel'

export default function AdminMfaSecurityPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (!session) return
    if (session.user.role !== 'ADMIN' && session.user.role !== 'OWNER') {
      router.push('/unauthorized')
      return
    }
    void fetch('/api/mfa/status')
      .then(r => r.json())
      .then(j => setEnabled(j.data?.enabled ?? false))
      .catch(() => setEnabled(false))
  }, [session, router])

  if (status === 'loading' || enabled === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-lg mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-white mb-2">أمان الحساب — MFA</h1>
        <p className="text-slate-400 text-sm mb-6">
          المصادقة الثنائية لحسابات الإدارة
        </p>

        <div className="mpi-card rounded-2xl p-6">
          {enabled ? (
            <div className="space-y-3">
              <p className="text-emerald-400 font-medium">✅ MFA مفعّل على حسابك</p>
              <p className="text-slate-400 text-sm">
                سيُطلب رمز التحقق عند كل تسجيل دخول بالبريد الإلكتروني.
              </p>
              <a
                href={session?.user.role === 'OWNER' ? '/owner' : '/admin'}
                className="inline-block mt-2 text-accent text-sm hover:underline"
              >
                ← العودة للوحة التحكم
              </a>
            </div>
          ) : (
            <MfaSetupPanel />
          )}
        </div>
      </div>
    </div>
  )
}
