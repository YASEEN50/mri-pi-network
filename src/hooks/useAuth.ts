'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { Role, ApprovalStatus } from '@prisma/client'

export function useAuth() {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const requireAuth = useCallback((redirectTo = '/login') => {
    if (status === 'unauthenticated') { router.push(redirectTo); return false }
    return true
  }, [status, router])

  const requireRole = useCallback((roles: Role[], redirectTo = '/unauthorized') => {
    if (!session) return false
    if (!roles.includes(session.user.role)) { router.push(redirectTo); return false }
    return true
  }, [session, router])

  return {
    user: session?.user ?? null,
    role: session?.user.role ?? null,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    isClient:   session?.user.role === Role.CLIENT,
    isDoctor:   session?.user.role === Role.DOCTOR,
    isFacility: session?.user.role === Role.FACILITY,
    isAdmin:    session?.user.role === Role.ADMIN,
    isApproved: session?.user.approvalStatus === ApprovalStatus.APPROVED,
    isPending:  session?.user.approvalStatus === ApprovalStatus.PENDING ||
                session?.user.approvalStatus === ApprovalStatus.DOCUMENTS_REVIEW,
    requireAuth,
    requireRole,
    updateSession: update,
  }
}
