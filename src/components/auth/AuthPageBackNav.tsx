'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const BACK_TARGETS: Record<string, string> = {
  '/register': '/login',
  '/forgot-password': '/login',
  '/reset-password': '/login',
}

export default function AuthPageBackNav() {
  const pathname = usePathname()
  const backHref = BACK_TARGETS[pathname]
  if (!backHref) return null

  return (
    <div className="max-w-md mx-auto px-4 pt-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
      >
        <span aria-hidden>←</span>
        رجوع
      </Link>
    </div>
  )
}
