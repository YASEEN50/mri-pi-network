'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { isPiBrowser, requestPiCookieAccess } from '@/lib/pi/pi-auth-client'

/**
 * Pi Browser embeds the app in a cross-site iframe — session cookies may be
 * blocked until requestStorageAccess() runs. Bootstrap once before pages redirect to /login.
 */
export function PiSessionGate({ children }: { children: React.ReactNode }) {
  const { status, update } = useSession()
  const [bootstrapped, setBootstrapped] = useState(() =>
    typeof window === 'undefined' ? true : !isPiBrowser(),
  )

  useEffect(() => {
    if (bootstrapped || !isPiBrowser()) return

    let active = true
    ;(async () => {
      await requestPiCookieAccess()
      try {
        await update()
      } catch {
        /* session refresh optional */
      }
      if (active) setBootstrapped(true)
    })()

    return () => {
      active = false
    }
  }, [bootstrapped, update])

  if (!bootstrapped || status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return <>{children}</>
}
