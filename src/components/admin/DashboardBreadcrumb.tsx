'use client'
// src/components/admin/DashboardBreadcrumb.tsx
// مسار مخصص — يُدمج مع PageBackNav عبر تسمية الصفحة الحالية

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { getDashboardHref as getDashHref, getDashboardLabel as getDashLabel } from '@/lib/navigation/breadcrumbs'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface Props {
  items: BreadcrumbItem[]
  className?: string
}

export function getAdminDashboardHref(role?: string): string {
  return getDashHref(role)
}

export function getAdminDashboardLabel(role?: string): string {
  return getDashLabel('ar', role)
}

/** يعرض مساراً إضافياً عند الحاجة لتسمية مخصصة (الرجوع العام في Navbar). */
export default function DashboardBreadcrumb({ items, className = '' }: Props) {
  const { data: session } = useSession()
  const role = session?.user?.role
  const dashboardHref = getDashHref(role)
  const dashboardLabel = getDashLabel('ar', role)

  const crumbs: BreadcrumbItem[] = [
    { label: dashboardLabel, href: dashboardHref },
    ...items,
  ]

  if (items.length === 0) return null

  return (
    <nav
      className={`flex items-center flex-wrap gap-x-1.5 gap-y-1 text-sm mb-3 ${className}`}
      aria-label="مسار التنقل"
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1.5">
            {i > 0 && <span className="text-slate-600 select-none">/</span>}
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="text-slate-400 hover:text-accent transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-white font-medium' : 'text-slate-400'}>
                {crumb.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
