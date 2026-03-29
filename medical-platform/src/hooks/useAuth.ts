// src/hooks/useAuth.ts
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

// =============================================================================
// src/hooks/useAppointments.ts
// =============================================================================

import { useState, useEffect, useCallback } from 'react'

interface Appointment {
  id: string
  status: string
  type: string
  scheduledAt: string
  duration: number
  reason?: string
  fee?: number
  isPaid: boolean
  doctorId?: string
  facilityId?: string
}

interface UseAppointmentsOptions {
  status?: string
  page?: number
  limit?: number
}

export function useAppointments(options: UseAppointmentsOptions = {}) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (options.status) params.set('status', options.status)
      if (options.page)   params.set('page', String(options.page))
      if (options.limit)  params.set('limit', String(options.limit))

      const res = await fetch(`/api/appointments?${params}`)
      const data = await res.json()

      if (!res.ok) { setError(data.error?.message ?? 'خطأ في تحميل المواعيد'); return }
      setAppointments(data.data)
      setTotal(data.meta?.total ?? 0)
    } catch {
      setError('خطأ في الاتصال بالخادم')
    } finally {
      setIsLoading(false)
    }
  }, [options.status, options.page, options.limit])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const cancelAppointment = useCallback(async (id: string, reason: string) => {
    const res = await fetch(`/api/appointments/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED', cancelReason: reason }),
    })
    if (res.ok) fetchAppointments()
    return res.ok
  }, [fetchAppointments])

  return { appointments, total, isLoading, error, refetch: fetchAppointments, cancelAppointment }
}
