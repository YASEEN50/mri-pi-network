'use client'

import Navbar from '@/components/common/Navbar'
import { useAppLocale } from '@/hooks/useAppLocale'

interface DashboardShellProps {
  children: React.ReactNode
  className?: string
}

export default function DashboardShell({ children, className = 'min-h-screen bg-slate-950' }: DashboardShellProps) {
  const { locale, dir } = useAppLocale()

  return (
    <div className={className} dir={dir}>
      <Navbar locale={locale} />
      {children}
    </div>
  )
}
