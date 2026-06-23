'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { isPiBrowserReady } from '@/lib/pi/pi-auth-client'
import PiLoginButton from '@/components/auth/PiLoginButton'

export function PiAuthProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const [inPi, setInPi] = useState(false)

  useEffect(() => {
    isPiBrowserReady(15_000).then(setInPi)
  }, [])

  const showPiSignIn = inPi && status === 'unauthenticated'

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
