'use client'
// src/components/payments/PaymentForm.tsx — Pi Network only (U2A)
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { payForAppointment, piPaymentErrorMessage } from '@/lib/pi/pi-payment-client'
import {
  resolveAppointmentPayment,
  type AppointmentPaymentPolicy,
} from '@/lib/payment/appointment-payment'

interface PaymentFormProps {
  appointmentId: string
  fee: number
  paymentPolicy: AppointmentPaymentPolicy
  depositPercentage?: number
  isDepositPaid?: boolean
  depositAmount?: number | null
  isPaid?: boolean
  onSuccess?: () => void
  /** full = breakdown card; compact = pay button only */
  variant?: 'full' | 'compact'
}

export default function PaymentForm({
  appointmentId,
  fee,
  paymentPolicy,
  depositPercentage = 30,
  isDepositPaid = false,
  depositAmount = null,
  isPaid = false,
  onSuccess,
  variant = 'full',
}: PaymentFormProps) {
  const router = useRouter()
  const [isPaying, setIsPaying] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const depositPctAmount = fee * (depositPercentage / 100)
  const remainingAmount = fee - (depositAmount ?? depositPctAmount)
  const quote = resolveAppointmentPayment({
    fee,
    paymentPolicy,
    depositPercentage,
    isDepositPaid,
    depositAmount,
    isPaid,
  })

  async function handlePay() {
    setIsPaying(true)
    setMessage(null)
    try {
      await payForAppointment({
        appointmentId,
        fee,
        paymentPolicy,
        depositPercentage,
        isDepositPaid,
        depositAmount,
        isPaid,
      })
      if (variant === 'compact') {
        onSuccess?.()
        router.refresh()
        return
      }
      setMessage({ type: 'success', text: 'تم الدفع بنجاح ✅' })
      setTimeout(() => {
        onSuccess?.()
        router.refresh()
      }, 1500)
    } catch (err) {
      const text = piPaymentErrorMessage(err)
      if (variant === 'compact') {
        setMessage({ type: 'error', text })
      } else {
        setMessage({ type: 'error', text })
      }
    } finally {
      setIsPaying(false)
    }
  }

  if (isPaid) return null

  if (paymentPolicy === 'PAY_ON_SERVICE') {
    if (variant === 'compact') return null
    return (
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4">
        <p className="text-blue-400 text-sm text-center">💳 الدفع يتم بعد انتهاء الخدمة — {fee} Pi</p>
      </div>
    )
  }

  if (!quote.requiresPayment) return null

  if (variant === 'compact') {
    return (
      <div className="flex flex-col gap-1">
        <button
          onClick={handlePay}
          disabled={isPaying}
          className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 rounded-lg text-xs transition-all disabled:opacity-50"
        >
          {isPaying ? 'جاري الدفع...' : `🟣 ادفع ${quote.amount.toFixed(4)} Pi`}
        </button>
        {message?.type === 'error' && (
          <p className="text-red-400 text-xs">{message.text}</p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5" dir="rtl">
      <h3 className="text-white font-semibold mb-4">💳 إتمام الدفع</h3>
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">الرسوم الكاملة</span>
          <span className="text-white">{fee} Pi</span>
        </div>
        {paymentPolicy === 'DEPOSIT_AND_PAY_LATER' && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">الإيداع ({depositPercentage}%)</span>
              <span className="text-amber-400">{depositPctAmount.toFixed(4)} Pi</span>
            </div>
            <div className="h-px bg-white/10 my-2" />
          </>
        )}
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-white">المبلغ الآن</span>
          <span className="text-emerald-400">{quote.amount.toFixed(4)} Pi</span>
        </div>
        {paymentPolicy === 'DEPOSIT_AND_PAY_LATER' && isDepositPaid && (
          <p className="text-slate-500 text-xs">المتبقي بعد الإيداع: {remainingAmount.toFixed(4)} Pi</p>
        )}
      </div>

      {message && (
        <div
          className={`mb-4 px-3 py-2 rounded-xl text-xs font-medium ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={isPaying}
        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 disabled:opacity-50 text-white rounded-xl font-medium transition-all"
      >
        {isPaying ? 'جاري الدفع...' : `دفع ${quote.amount.toFixed(4)} Pi عبر Pi Network`}
      </button>
      <p className="text-slate-500 text-xs text-center mt-2">🔒 الدفع آمن عبر Pi Network Blockchain</p>
    </div>
  )
}
