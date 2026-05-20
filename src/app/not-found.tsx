// src/app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4" dir="rtl">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-white/5 mb-2" style={{fontSize:'120px'}}>404</div>
        <h1 className="text-2xl font-bold text-white mb-2">الصفحة غير موجودة</h1>
        <p className="text-slate-400 mb-6 text-sm">الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>
        <Link href="/"
          className="inline-block px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all">
          العودة للرئيسية
        </Link>
      </div>
    </div>
  )
}
