'use client'

import { isPiBrowser, markExplicitLogout } from '@/lib/pi/pi-auth-client'

/** Reliable logout — server signout clears cookies, skip flag blocks auto-resume on entry pages. */
export function performLogout(redirectTo?: string): void {
  markExplicitLogout()
  const target = redirectTo ?? (isPiBrowser() ? '/' : '/login?site=full')
  window.location.href = `/api/auth/signout?callbackUrl=${encodeURIComponent(target)}`
}
