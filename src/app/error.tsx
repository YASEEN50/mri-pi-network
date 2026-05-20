'use client'
// src/app/error.tsx
import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4" dir="rtl">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-white mb-2">حدث خطأ غير متوقع</h1>
        <p className="text-slate-400 mb-6 text-sm">نعتذر عن هذا الخطأ. يمكنك المحاولة مرة أخرى أو العودة للرئيسية.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-medium transition-all">
            إعادة المحاولة
          </button>
          <Link href="/"
            className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm font-medium transition-all">
            الرئيسية
          </Link>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <p className="mt-4 text-xs text-red-400 font-mono">{error.message}</p>
        )}
      </div>
    </div>
  )
}
