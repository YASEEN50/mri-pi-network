'use client'
// src/components/admin/DashboardBreadcrumb.tsx

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Role } from '@prisma/client'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface Props {
  items: BreadcrumbItem[]
  className?: string
}

export function getAdminDashboardHref(role?: string): string {
  return role === Role.OWNER ? '/owner' : '/dashboard/admin/verification'
}

export function getAdminDashboardLabel(role?: string): string {
  return role === Role.OWNER ? 'لوحة المالك' : 'لوحة التحكم'
}

export default function DashboardBreadcrumb({ items, className = '' }: Props) {
  const { data: session } = useSession()
  const role = session?.user?.role
  const dashboardHref = getAdminDashboardHref(role)
  const dashboardLabel = getAdminDashboardLabel(role)

  const crumbs: BreadcrumbItem[] = [
    { label: dashboardLabel, href: dashboardHref },
    ...items,
  ]

  return (
    <nav
      className={`flex items-center flex-wrap gap-x-1.5 gap-y-1 text-sm ${className}`}
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
                className="text-slate-400 hover:text-accent transition-colors inline-flex items-center gap-1"
              >
                {i === 0 && <span aria-hidden>←</span>}
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
