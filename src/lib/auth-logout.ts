'use client'

import { signOut } from 'next-auth/react'
import { markExplicitLogout } from '@/lib/pi/pi-auth-client'

/** Reliable logout for Next.js App Router — clears session then hard-navigates. */
export async function performLogout(redirectTo = '/'): Promise<void> {
  markExplicitLogout()
  await signOut({ redirect: false })
  window.location.href = redirectTo
}
