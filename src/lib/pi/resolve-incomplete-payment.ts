'use client'

import type { PiPaymentDto } from '@/lib/pi/pi-payment-dto'

const PENDING_INCOMPLETE_KEY = 'pi_pending_incomplete'

function storePendingIncomplete(payment: unknown): void {
  try {
    sessionStorage.setItem(PENDING_INCOMPLETE_KEY, JSON.stringify(payment))
  } catch { /* ignore */ }
}

function takePendingIncomplete(): unknown | null {
  try {
    const raw = sessionStorage.getItem(PENDING_INCOMPLETE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(PENDING_INCOMPLETE_KEY)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function postIncompletePayment(
  payment: unknown,
  accessToken?: string,
): Promise<{ ok: boolean; authRequired?: boolean }> {
  const res = await fetch('/api/payment/pi/incomplete', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment, accessToken }),
  })
  const data = await res.json()
  if (data.success && !data.data?.error) return { ok: true }
  if (data.data?.code === 'AUTH_REQUIRED') return { ok: false, authRequired: true }
  throw new Error(data.data?.message || data.message || 'فشل إكمال الدفع المعلق')
}

/** Complete in-flight Pi payment via backend (required by Pi SDK). */
export function resolveIncompletePiPayment(payment: unknown): void {
  void postIncompletePayment(payment)
    .then((result) => {
      if (!result.ok && result.authRequired) storePendingIncomplete(payment)
    })
    .catch((err) => {
      console.error('[Pi] Failed to resolve incomplete payment:', err)
      storePendingIncomplete(payment)
    })
}

export async function resolveIncompletePiPaymentAsync(payment: PiPaymentDto): Promise<void> {
  await postIncompletePayment(payment)
}

/** Retry incomplete payment after session is established (e.g. post-login). */
export async function flushPendingIncompletePayments(accessToken?: string): Promise<void> {
  const pending = takePendingIncomplete()
  if (!pending) return
  try {
    await postIncompletePayment(pending, accessToken)
  } catch (err) {
    console.error('[Pi] Failed to flush pending incomplete payment:', err)
    storePendingIncomplete(pending)
  }
}
