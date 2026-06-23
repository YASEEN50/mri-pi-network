'use client'

import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isPiBrowserReady } from '@/lib/pi/pi-auth-client'
import PiLoginButton from '@/components/auth/PiLoginButton'

const AUTH_PATHS = ['/login', '/register', '/forgot-password']

export function PiAuthProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const pathname = usePathname()
  const [inPi, setInPi] = useState(false)

  useEffect(() => {
    isPiBrowserReady(15_000).then(setInPi)
  }, [])

  const isAuthPage = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const showPiSignIn = inPi && status === 'unauthenticated' && !isAuthPage

  return (
    <>
      {children}
      {showPiSignIn && (
        <div className="fixed bottom-6 inset-x-4 z-[100] mx-auto max-w-sm rounded-xl bg-slate-900/95 border border-white/10 p-3 shadow-xl">
          <PiLoginButton callbackUrl="/dashboard" compact />
        </div>
      )}
    </>
  )
}
