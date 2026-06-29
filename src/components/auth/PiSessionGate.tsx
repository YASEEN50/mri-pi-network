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
    const timeout = window.setTimeout(() => {
      if (active) setBootstrapped(true)
    }, 3000)

    ;(async () => {
      await requestPiCookieAccess()
      try {
        await Promise.race([
          update(),
          new Promise<void>((resolve) => window.setTimeout(resolve, 2500)),
        ])
      } catch {
        /* session refresh optional */
      }
      if (active) setBootstrapped(true)
    })()

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [bootstrapped, update])

  const waiting = !bootstrapped || (status === 'loading' && isPiBrowser())

  if (waiting) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center gap-3">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        <p className="text-slate-400 text-sm">جاري تحميل الجلسة...</p>
      </div>
    )
  }

  return <>{children}</>
}
