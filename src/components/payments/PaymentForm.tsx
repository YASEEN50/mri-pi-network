'use client'
// src/components/payments/PaymentForm.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PaymentFormProps {
  appointmentId: string
  fee: number
  paymentPolicy: 'PAY_BEFORE_BOOKING' | 'DEPOSIT_AND_PAY_LATER' | 'PAY_ON_SERVICE'
  depositPercentage?: number
  isDepositPaid?: boolean
  onSuccess?: () => void
}

export default function PaymentForm({ appointmentId, fee, paymentPolicy, depositPercentage = 30, isDepositPaid = false, onSuccess }: PaymentFormProps) {
  const router = useRouter()
  const [isPaying, setIsPaying] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const depositAmount = fee * (depositPercentage / 100)
  const remainingAmount = fee - depositAmount

  const getPaymentType = () => {
    if (paymentPolicy === 'PAY_BEFORE_BOOKING') return 'FULL'
    if (paymentPolicy === 'DEPOSIT_AND_PAY_LATER') return isDepositPaid ? 'FULL' : 'DEPOSIT'
    return 'FULL'
  }

  const getAmountToPay = () => {
    if (paymentPolicy === 'DEPOSIT_AND_PAY_LATER' && !isDepositPaid) return depositAmount
    if (paymentPolicy === 'DEPOSIT_AND_PAY_LATER' && isDepositPaid) return remainingAmount
    return fee
  }

  const paymentType = getPaymentType()
  const amountToPay = getAmountToPay()

  if (paymentPolicy === 'PAY_ON_SERVICE') {
    return (
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4">
        <p className="text-blue-400 text-sm text-center">💳 الدفع يتم بعد انتهاء الخدمة - {fee} Pi</p>
      </div>
    )
  }

  async function handlePay() {
    setIsPaying(true)
    setMessage(null)
    try {
      const res = await fetch('/api/payment/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, paymentType }),
      })
      const data = await res.json()
      if (data.success && !data.data?.error) {
        setMessage({ type: 'success', text: 'تم الدفع بنجاح ✅' })
        setTimeout(() => { onSuccess?.(); router.refresh() }, 1500)
      } else {
        setMessage({ type: 'error', text: data.data?.message || 'حدث خطأ في الدفع' })
      }
    } catch { setMessage({ type: 'error', text: 'حدث خطأ في الاتصال' }) }
    finally { setIsPaying(false) }
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
              <span className="text-amber-400">{depositAmount.toFixed(4)} Pi</span>
            </div>
            <div className="h-px bg-white/10 my-2" />
          </>
        )}
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-white">المبلغ الآن</span>
          <span className="text-emerald-400">{amountToPay.toFixed(4)} Pi</span>
        </div>
      </div>

      {message && (
        <div className={`mb-4 px-3 py-2 rounded-xl text-xs font-medium ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <button onClick={handlePay} disabled={isPaying}
        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 disabled:opacity-50 text-white rounded-xl font-medium transition-all">
        {isPaying ? 'جاري الدفع...' : `دفع ${amountToPay.toFixed(4)} Pi عبر Pi Network`}
      </button>
      <p className="text-slate-500 text-xs text-center mt-2">🔒 الدفع آمن عبر Pi Network Blockchain</p>
    </div>
  )
}
