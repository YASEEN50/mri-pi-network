'use client'

import Link from 'next/link'

const LOGO_SVG = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
)

export function AuthBrand({
  subtitle = 'منصة طبية موثوقة',
}: {
  subtitle?: string
}) {
  return (
    <div className="pi-auth-brand">
      <div className="pi-auth-logo" aria-hidden="true">
        {LOGO_SVG}
      </div>
      <h1 className="pi-auth-title">MRI</h1>
      <p className="pi-auth-subtitle">{subtitle}</p>
    </div>
  )
}

export function AuthTrustBadges() {
  return (
    <div className="pi-auth-trust">
      <span>🔒 اتصال آمن</span>
      <span>🟣 Pi Network</span>
      <span>✓ موثوق</span>
    </div>
  )
}

export function AuthFooterLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} className="pi-auth-footer-link">
      {children}
    </Link>
  )
}

export function AuthLayout({
  subtitle,
  cardTitle,
  hint,
  children,
  footer,
  showTrust = true,
  error,
}: {
  subtitle?: string
  cardTitle?: string
  hint?: string
  children: React.ReactNode
  footer?: React.ReactNode
  showTrust?: boolean
  error?: string
}) {
  return (
    <div className="pi-auth-shell">
      <div className="pi-auth-medical" aria-hidden="true" />
      <div className="pi-auth-scrim" aria-hidden="true" />
      <div className="pi-auth-bg" />
      <div className="pi-auth-glow" />
      <div className="pi-auth-glow-orb" />

      <div className="pi-auth-wrap">
        <AuthBrand subtitle={subtitle} />

        <div className="pi-auth-card">
          {cardTitle && <h2>{cardTitle}</h2>}
          {hint && <p className="pi-auth-hint">{hint}</p>}
          {error && <p className="pi-auth-error">{error}</p>}
          {children}
          {showTrust && <AuthTrustBadges />}
        </div>

        {footer}
      </div>
    </div>
  )
}
