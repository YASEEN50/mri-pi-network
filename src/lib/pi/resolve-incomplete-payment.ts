'use client'

import type { PiPaymentDto } from '@/lib/pi/pi-payment-dto'

/** Complete in-flight Pi payment via backend (required by Pi SDK). */
export function resolveIncompletePiPayment(payment: unknown): void {
  void fetch('/api/payment/pi/incomplete', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment }),
  }).catch((err) => {
    console.error('[Pi] Failed to resolve incomplete payment:', err)
  })
}

export async function resolveIncompletePiPaymentAsync(payment: PiPaymentDto): Promise<void> {
  const res = await fetch('/api/payment/pi/incomplete', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment }),
  })
  const data = await res.json()
  if (!data.success || data.data?.error) {
    throw new Error(data.data?.message || data.message || 'فشل إكمال الدفع المعلق')
  }
}
