'use client'
// src/components/owner/OwnerSubpageLayout.tsx

import Navbar from '@/components/common/Navbar'

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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
