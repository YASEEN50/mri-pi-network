'use client'
// src/components/owner/OwnerSubpageLayout.tsx

import Link from 'next/link'
import Navbar from '@/components/common/Navbar'
import DashboardBreadcrumb from '@/components/admin/DashboardBreadcrumb'

interface OwnerSubpageLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  maxWidth?: '2xl' | '4xl' | '7xl'
}

const WIDTH: Record<NonNullable<OwnerSubpageLayoutProps['maxWidth']>, string> = {
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '7xl': 'max-w-7xl',
}

export default function OwnerSubpageLayout({
  title,
  subtitle,
  children,
  maxWidth = '2xl',
}: OwnerSubpageLayoutProps) {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar locale="ar" />
      <div className={`${WIDTH[maxWidth]} mx-auto px-4 sm:px-6 py-8`}>
        <DashboardBreadcrumb items={[{ label: title }]} className="mb-4" />
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <Link
            href="/owner"
            className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-primary/10 hover:border-primary/25 rounded-xl text-sm transition-all"
          >
            ← لوحة المالك
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
