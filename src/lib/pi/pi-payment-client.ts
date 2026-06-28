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
  purpose: 'PREMIO' | 'APPOINTMENT' | 'INSTANT_CONSULT' | 'PAID_AD'
  amount: number
  planType?: 'MONTHLY' | 'YEARLY' | 'LIFETIME'
  appointmentId?: string
  instantConsultId?: string
  adId?: string
  adPlan?: 'WEEKLY' | 'MONTHLY'
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

import {
  resolveAppointmentPayment,
  type AppointmentPaymentPolicy,
} from '@/lib/payment/appointment-payment'

export interface PayForAppointmentInput {
  appointmentId: string
  fee: number
  paymentPolicy: AppointmentPaymentPolicy
  depositPercentage?: number
  isDepositPaid?: boolean
  depositAmount?: number | null
  isPaid?: boolean
}

/** Appointment fee / deposit via Pi U2A */
export async function payForAppointment(
  input: PayForAppointmentInput,
): Promise<{ paymentId: string; txid: string }> {
  const quote = resolveAppointmentPayment(input)
  if (!quote.requiresPayment || quote.amount <= 0) {
    throw new Error('لا يوجد مبلغ مستحق للدفع')
  }

  return payWithPi({
    amount: quote.amount,
    memo: 'دفع موعد طبي',
    metadata: { purpose: 'APPOINTMENT', appointmentId: input.appointmentId },
    approvePayload: {
      purpose: 'APPOINTMENT',
      amount: quote.amount,
      appointmentId: input.appointmentId,
      paymentType: quote.paymentType,
    },
  })
}

/** Instant consult fee via Pi U2A */
export async function payForInstantConsult(
  instantConsultId: string,
  fee: number,
): Promise<{ paymentId: string; txid: string }> {
  if (fee <= 0) throw new Error('رسوم الاستشارة غير محددة')

  return payWithPi({
    amount: fee,
    memo: 'استشارة فورية',
    metadata: { purpose: 'INSTANT_CONSULT', instantConsultId },
    approvePayload: {
      purpose: 'INSTANT_CONSULT',
      amount: fee,
      instantConsultId,
    },
  })
}

/** Paid sidebar advertisement via Pi U2A */
export async function payForAdvertisement(
  adId: string,
  amount: number,
  adPlan: 'WEEKLY' | 'MONTHLY',
  title: string,
): Promise<{ paymentId: string; txid: string }> {
  if (amount <= 0) throw new Error('سعر الإعلان غير محدد')

  return payWithPi({
    amount,
    memo: `إعلان MRI: ${title.slice(0, 40)}`,
    metadata: { purpose: 'PAID_AD', adId, adPlan },
    approvePayload: {
      purpose: 'PAID_AD',
      amount,
      adId,
      adPlan,
    },
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
