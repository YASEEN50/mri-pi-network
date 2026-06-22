'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { isPiBrowser, signInWithPiNetwork, shouldSkipPiAutoLogin } from '@/lib/pi/pi-auth-client'

const SKIP_AUTO_AUTH_PREFIXES = ['/api/auth']

export function PiAuthProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const router       = useRouter()
  const pathname     = usePathname()
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (attemptedRef.current) return
    if (status !== 'unauthenticated') return
    if (shouldSkipPiAutoLogin()) return
    if (!isPiBrowser()) return
    if (SKIP_AUTO_AUTH_PREFIXES.some(p => pathname?.startsWith(p))) return

    attemptedRef.current = true

    void (async () => {
      const result = await signInWithPiNetwork()
      if (result.ok) {
        router.refresh()
      }
    })()
  }, [status, pathname, router])

  return <>{children}</>
}
