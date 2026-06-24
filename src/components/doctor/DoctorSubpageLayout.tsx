'use client'
// src/components/doctor/DoctorSubpageLayout.tsx

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import DashboardShell from '@/components/dashboard/DashboardShell'

interface DoctorSubpageLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  maxWidth?: '2xl' | '4xl'
}

const WIDTH: Record<NonNullable<DoctorSubpageLayoutProps['maxWidth']>, string> = {
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
}

export default function DoctorSubpageLayout({
  title,
  subtitle,
  children,
  maxWidth = '2xl',
}: DoctorSubpageLayoutProps) {
  const t = useTranslations('dashboard')

  return (
    <DashboardShell>
      <div className={`${WIDTH[maxWidth]} mx-auto px-4 sm:px-6 py-8`}>
        <nav className="flex items-center flex-wrap gap-x-1.5 gap-y-1 text-sm mb-4 text-slate-500" aria-label="breadcrumb">
          <Link href="/dashboard/doctor/schedule" className="hover:text-accent transition-colors">
            {t('breadcrumb_schedule')}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-300">{title}</span>
        </nav>

        <div className="flex flex-wrap items-center gap-3 mb-8">
          <Link
            href="/dashboard/doctor/schedule"
            className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-primary/10 hover:border-primary/25 rounded-xl text-sm transition-all"
          >
            {t('back_to_schedule')}
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
          </div>
        </div>

        {children}
      </div>
    </DashboardShell>
  )
}
