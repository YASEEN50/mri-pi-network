'use client'
// src/lib/pi/pi-payment-client.ts — Premio U2A via Pi.createPayment

import { initPiSdk, isPiBrowserReady } from '@/lib/pi/pi-auth-client'
import { PI_AUTH_SCOPES, PREMIO_PRODUCT } from '@/lib/pi/pi-scopes'
import { resolveIncompletePiPayment } from '@/lib/pi/resolve-incomplete-payment'

export async function requirePiBrowserForPayment(): Promise<void> {
  const ready = await isPiBrowserReady()
  if (!ready) {
    throw new Error('PI_BROWSER_REQUIRED')
  }
}

export async function authenticateForPiPayments(): Promise<void> {
  await requirePiBrowserForPayment()
  await initPiSdk()
  await Promise.resolve(
    window.Pi!.authenticate([...PI_AUTH_SCOPES], resolveIncompletePiPayment),
  )
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
              credentials: 'include',
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
              credentials: 'include',
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
        onError:  (error: Error, payment?: unknown) => {
          if (payment) resolveIncompletePiPayment(payment)
          reject(error)
        },
      },
    )
  })
}

/** Premio subscription payment (U2A) */
export async function payForPremioPlan(
  planType: 'MONTHLY' | 'YEARLY' | 'LIFETIME',
  price: number,
  label: string,
): Promise<{ paymentId: string; txid: string }> {
  return payWithPi({
    amount: price,
    memo: `${PREMIO_PRODUCT.memoPrefix} ${label}`,
    metadata: { purpose: PREMIO_PRODUCT.purpose, planType },
    approvePayload: {
      purpose: PREMIO_PRODUCT.purpose,
      amount: price,
      planType,
    },
  })
}

export function piPaymentErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === 'PI_BROWSER_REQUIRED') {
      return 'تعذّر تهيئة Pi للدفع. تأكد أنك داخل Pi Browser ثم أعد تحميل الصفحة.'
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
