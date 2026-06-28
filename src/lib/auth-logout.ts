'use client'

import { signOut } from 'next-auth/react'
import { markExplicitLogout } from '@/lib/pi/pi-auth-client'

/** POST signout (no NextAuth confirmation page) then redirect to guest landing. */
export async function performLogout(redirectTo?: string): Promise<void> {
  markExplicitLogout()
  const target = redirectTo ?? '/'
  await signOut({ callbackUrl: target, redirect: true })
}
