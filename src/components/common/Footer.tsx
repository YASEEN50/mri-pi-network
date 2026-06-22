'use client'
// src/components/common/Footer.tsx

import Link from 'next/link'

interface FooterProps {
  locale?: 'ar' | 'en'
}

export default function Footer({ locale = 'ar' }: FooterProps) {
  const isAr = locale === 'ar'
  const year = new Date().getFullYear()

  const links = [
    { href: '/about',       label: isAr ? 'من نحن' : 'About' },
    { href: '/terms',       label: isAr ? 'الشروط' : 'Terms' },
    { href: '/privacy',     label: isAr ? 'الخصوصية' : 'Privacy' },
    { href: '/contact',     label: isAr ? 'اتصل بنا' : 'Contact' },
  ]

  return (
    <footer className="border-t border-white/[0.06] bg-background-deep/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow-primary">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <span className="font-bold text-white text-lg leading-tight block">MRI</span>
                <span className="text-[11px] text-slate-400">
                  {isAr ? 'منصة طبية موثوقة' : 'Trusted Medical Platform'}
                </span>
              </div>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
              {isAr
                ? 'منصة طبية موثوقة تربط المرضى بالأطباء والمنشآت الصحية المعتمدة.'
                : 'Trusted medical platform connecting patients with verified doctors and facilities.'}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">{isAr ? 'روابط سريعة' : 'Quick Links'}</h4>
            <ul className="space-y-2">
              {links.map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-slate-500 hover:text-accent text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">{isAr ? 'استكشف' : 'Explore'}</h4>
            <ul className="space-y-2">
              {[
                { href: '/doctors', label: isAr ? 'الأطباء' : 'Doctors' },
                { href: '/facilities', label: isAr ? 'المنشآت' : 'Facilities' },
                { href: '/publications', label: isAr ? 'المنشورات' : 'Publications' },
                { href: '/register', label: isAr ? 'إنشاء حساب' : 'Register' },
              ].map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-slate-500 hover:text-accent text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-600 text-xs">
          <p>© {year} MRI. {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}</p>
          <p className="text-slate-700">{isAr ? 'مدعوم من Pi Network' : 'Powered by Pi Network'}</p>
        </div>
      </div>
    </footer>
  )
}
