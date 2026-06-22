// src/components/layout/LegalPageLayout.tsx

import Navbar from '@/components/common/Navbar'
import Footer from '@/components/common/Footer'
import Link from 'next/link'

interface LegalPageLayoutProps {
  locale?: 'ar' | 'en'
  title: string
  subtitle?: string
  children: React.ReactNode
}

export default function LegalPageLayout({
  locale = 'ar',
  title,
  subtitle,
  children,
}: LegalPageLayoutProps) {
  const isAr = locale === 'ar'

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={isAr ? 'rtl' : 'ltr'}>
      <Navbar locale={locale} />

      <div className="relative mpi-grid-bg mpi-hero-glow border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 text-center animate-fade-in">
          <Link href="/" className="text-accent text-sm hover:text-white transition-colors mb-4 inline-block">
            ← {isAr ? 'الرئيسية' : 'Home'}
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{title}</h1>
          {subtitle && <p className="text-slate-400 mt-3 text-sm leading-relaxed">{subtitle}</p>}
        </div>
      </div>

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-12 w-full animate-slide-up">
        <div className="mpi-card p-6 sm:p-8 prose prose-invert prose-sm max-w-none
          prose-headings:text-white prose-p:text-slate-300 prose-li:text-slate-300 prose-a:text-accent">
          {children}
        </div>
      </main>

      <Footer locale={locale} />
    </div>
  )
}
