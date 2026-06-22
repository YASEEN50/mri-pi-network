'use client'
// src/lib/pi/pi-payment-client.ts — دفع Pi عبر SDK (approve + complete)

import { initPiSdk, isPiBrowser } from '@/lib/pi/pi-auth-client'

const PI_PAYMENT_SCOPES = ['username', 'payments'] as const

function onIncompletePaymentFound(payment: unknown): void {
  console.warn('[Pi] Incomplete payment:', payment)
}

export function requirePiBrowserForPayment(): void {
  if (!isPiBrowser()) {
    throw new Error('PI_BROWSER_REQUIRED')
  }
  if (typeof window.Pi === 'undefined') {
    throw new Error('PI_SDK_UNAVAILABLE')
  }
}

export async function authenticateForPiPayments(): Promise<void> {
  requirePiBrowserForPayment()
  await initPiSdk()
  await window.Pi!.authenticate([...PI_PAYMENT_SCOPES], onIncompletePaymentFound)
}

export interface PiPayApprovePayload {
  paymentId: string
  purpose: 'PREMIO' | 'APPOINTMENT'
  amount: number
  planType?: 'MONTHLY' | 'YEARLY' | 'LIFETIME'
  appointmentId?: string
  paymentType?: 'FULL' | 'DEPOSIT'
}

export interface PiPayOptions {
  amount: number
  memo: string
  metadata: Record<string, unknown>
  approvePayload: Omit<PiPayApprovePayload, 'paymentId'>
}

export async function payWithPi(options: PiPayOptions): Promise<{ paymentId: string; txid: string }> {
  requirePiBrowserForPayment()
  await authenticateForPiPayments()

  return new Promise((resolve, reject) => {
    window.Pi!.createPayment(
      {
        amount:   options.amount,
        memo:     options.memo,
        metadata: options.metadata,
      },
      {
        onReadyForServerApproval: async (paymentId: string) => {
          try {
            const res = await fetch('/api/payment/pi/approve', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                paymentId,
                ...options.approvePayload,
              }),
            })
            const data = await res.json()
            if (!data.success || data.data?.error) {
              reject(new Error(data.data?.message || data.message || 'فشلت موافقة الخادم على الدفع'))
            }
          } catch (e) {
            reject(e instanceof Error ? e : new Error('فشلت موافقة الدفع'))
          }
        },
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          try {
            const res = await fetch('/api/payment/pi/complete', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ paymentId, txid }),
            })
            const data = await res.json()
            if (!data.success || data.data?.error) {
              reject(new Error(data.data?.message || data.message || 'فشل إتمام الدفع'))
              return
            }
            resolve({ paymentId, txid })
          } catch (e) {
            reject(e instanceof Error ? e : new Error('فشل إتمام الدفع'))
          }
        },
        onCancel: () => reject(new Error('PAYMENT_CANCELLED')),
        onError:  (error: Error) => reject(error),
      },
    )
  })
}

export function piPaymentErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === 'PI_BROWSER_REQUIRED') {
      return 'الدفع متاح فقط داخل Pi Browser بعملة Pi'
    }
    if (err.message === 'PI_SDK_UNAVAILABLE') {
      return 'Pi SDK غير متوفر. افتح التطبيق من Pi Browser'
    }
    if (err.message === 'PAYMENT_CANCELLED') {
      return 'تم إلغاء عملية الدفع'
    }
    return err.message
  }
  return 'حدث خطأ أثناء الدفع'
}
