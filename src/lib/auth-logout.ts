'use client'

import { signOut } from 'next-auth/react'
import { isPiBrowser, markExplicitLogout } from '@/lib/pi/pi-auth-client'

/** POST signout (no NextAuth confirmation page) then redirect. */
export async function performLogout(redirectTo?: string): Promise<void> {
  markExplicitLogout()
  const target = redirectTo ?? (isPiBrowser() ? '/' : '/login?site=full')
  await signOut({ callbackUrl: target, redirect: true })
}
