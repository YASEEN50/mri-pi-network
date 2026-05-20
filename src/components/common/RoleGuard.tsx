'use client'
// src/components/common/RoleGuard.tsx
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: string[]
  fallback?: React.ReactNode
  redirectTo?: string
}

export default function RoleGuard({ children, allowedRoles, fallback, redirectTo = '/unauthorized' }: RoleGuardProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role && !allowedRoles.includes(session.user.role)) {
      if (!fallback) router.push(redirectTo)
    }
  }, [status, session, allowedRoles, router, redirectTo, fallback])

  if (status === 'loading') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  if (status === 'unauthenticated') return null
  if (!allowedRoles.includes(session?.user?.role ?? '')) {
    if (fallback) return <>{fallback}</>
    return null
  }

  return <>{children}</>
}

export function useRole() {
  const { data: session, status } = useSession()
  return {
    role: session?.user?.role,
    isOwner: session?.user?.role === 'OWNER',
    isAdmin: session?.user?.role === 'ADMIN' || session?.user?.role === 'OWNER',
    isDoctor: session?.user?.role === 'DOCTOR',
    isFacility: session?.user?.role === 'FACILITY',
    isClient: session?.user?.role === 'CLIENT',
    isLoading: status === 'loading',
    isLoggedIn: status === 'authenticated',
  }
}
