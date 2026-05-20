'use client'
// src/components/payments/DepositCalculator.tsx
interface Props {
  fee: number
  paymentPolicy: 'PAY_BEFORE_BOOKING' | 'DEPOSIT_AND_PAY_LATER' | 'PAY_ON_SERVICE'
  depositPercentage?: number
  isDepositPaid?: boolean
}

export default function DepositCalculator({ fee, paymentPolicy, depositPercentage = 30, isDepositPaid = false }: Props) {
  const depositAmount = fee * (depositPercentage / 100)
  const remainingAmount = fee - depositAmount

  if (paymentPolicy === 'PAY_ON_SERVICE') return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4" dir="rtl">
      <p className="text-slate-400 text-xs mb-2">💳 سياسة الدفع</p>
      <div className="flex justify-between items-center">
        <span className="text-slate-300 text-sm">دفع بعد الخدمة</span>
        <span className="text-white font-semibold">{fee} Pi</span>
      </div>
    </div>
  )

  if (paymentPolicy === 'PAY_BEFORE_BOOKING') return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4" dir="rtl">
      <p className="text-slate-400 text-xs mb-2">💳 سياسة الدفع</p>
      <div className="flex justify-between items-center">
        <span className="text-slate-300 text-sm">دفع كامل مسبقاً</span>
        <span className="text-emerald-400 font-semibold">{fee} Pi</span>
      </div>
    </div>
  )

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4" dir="rtl">
      <p className="text-slate-400 text-xs mb-3">💳 تفاصيل الدفع</p>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">الرسوم الكاملة</span>
          <span className="text-white">{fee} Pi</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">إيداع الآن ({depositPercentage}%)</span>
          <div className="flex items-center gap-2">
            {isDepositPaid && <span className="text-emerald-400 text-xs">✅ مدفوع</span>}
            <span className={isDepositPaid ? 'text-slate-500 line-through' : 'text-amber-400 font-medium'}>{depositAmount.toFixed(4)} Pi</span>
          </div>
        </div>
        <div className="h-px bg-white/10" />
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">المتبقي بعد الخدمة</span>
          <span className="text-slate-300">{remainingAmount.toFixed(4)} Pi</span>
        </div>
      </div>
      <div className="mt-3">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: isDepositPaid ? `${depositPercentage}%` : '0%' }} />
        </div>
      </div>
    </div>
  )
}
