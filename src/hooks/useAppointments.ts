'use client'
// src/hooks/useAppointments.ts
import { useState, useEffect, useCallback } from 'react'

export interface Appointment {
  id:          string
  status:      string
  type:        string
  scheduledAt: string
  duration:    number
  reason?:     string
  notes?:      string
  doctorNotes?: string
  cancelReason?: string
  fee?:        number
  isPaid:      boolean
  isDepositPaid?: boolean
  depositAmount?: number | null
  paymentPolicy?: 'PAY_BEFORE_BOOKING' | 'DEPOSIT_AND_PAY_LATER' | 'PAY_ON_SERVICE'
  depositPercentage?: number
  doctorId?:   string
  facilityId?: string
  clientId?:   string
  doctor?:     string
  doctorDetails?: { id: string; specialization?: string; avatarUrl?: string }
  facility?:   string
  clientName?: string
  hasReview?:  boolean
  reviewRating?: number
  canJoinVideo?: boolean
  videoJoinPath?: string | null
}

export function useAppointments(options: {
  status?:   string
  doctorId?: string
  fromDate?: string
  toDate?:   string
  page?:     number
  limit?:    number
} = {}) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [total,        setTotal]        = useState(0)
  const [isLoading,    setIsLoading]    = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (options.status)   params.set('status',   options.status)
      if (options.doctorId) params.set('doctorId', options.doctorId)
      if (options.fromDate) params.set('fromDate',  options.fromDate)
      if (options.toDate)   params.set('toDate',    options.toDate)
      if (options.page)     params.set('page',      String(options.page))
      if (options.limit)    params.set('limit',     String(options.limit))

      const res  = await fetch(`/api/appointments?${params}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error?.message ?? 'خطأ'); return }
      setAppointments(data.data ?? [])
      setTotal(data.meta?.total ?? 0)
    } catch {
      setError('خطأ في الاتصال')
    } finally {
      setIsLoading(false)
    }
  }, [options.status, options.doctorId, options.fromDate, options.toDate, options.page, options.limit])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const updateStatus = useCallback(async (
    id: string, status: string, meta?: Record<string, string>
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/appointments/${id}/status`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status, ...meta }),
      })
      if (res.ok) { fetchAppointments(); return true }
      return false
    } catch { return false }
  }, [fetchAppointments])

  return {
    appointments, total, isLoading, error,
    refetch:             fetchAppointments,
    cancelAppointment:   (id: string, reason: string) => updateStatus(id, 'CANCELLED', { cancelReason: reason }),
    confirmAppointment:  (id: string) => updateStatus(id, 'CONFIRMED'),
    completeAppointment: (id: string, doctorNotes?: string) =>
      updateStatus(id, 'COMPLETED', doctorNotes ? { doctorNotes } : undefined),
    noShowAppointment:   (id: string) => updateStatus(id, 'NO_SHOW'),
  }
}
