'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { buildNavigationTrail } from '@/lib/navigation/breadcrumbs'

interface PageBackNavProps {
  locale: 'ar' | 'en'
}

export default function PageBackNav({ locale }: PageBackNavProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const trail = buildNavigationTrail(pathname, locale, session?.user?.role, {
    roomId: searchParams.get('room'),
  })

  if (!trail?.backHref) return null

  const { backHref, backLabel, crumbs } = trail

  return (
    <div className="border-b border-white/[0.04] bg-background/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link
          href={backHref}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-white/5 border border-white/10 hover:bg-primary/15 hover:border-primary/30 hover:text-accent transition-all shrink-0 w-fit"
        >
          <span aria-hidden className="text-base leading-none">←</span>
          <span>{backLabel ?? (locale === 'ar' ? 'رجوع' : 'Back')}</span>
        </Link>

        <nav
          className="flex items-center flex-wrap gap-x-1.5 gap-y-1 text-xs sm:text-sm min-w-0"
          aria-label={locale === 'ar' ? 'مسار التنقل' : 'Breadcrumb'}
        >
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1
            return (
              <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1.5 min-w-0">
                {i > 0 && <span className="text-slate-600 select-none">/</span>}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="text-slate-400 hover:text-accent transition-colors truncate max-w-[9rem] sm:max-w-none"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={`truncate max-w-[10rem] sm:max-w-none ${isLast ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                    {crumb.label}
                  </span>
                )}
              </span>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
