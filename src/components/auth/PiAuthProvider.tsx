'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import {
  isPiBrowserReady,
  runPiAuthOnLoad,
} from '@/lib/pi/pi-auth-client'
import PiLoginButton from '@/components/auth/PiLoginButton'

export function PiAuthProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const autoStarted = useRef(false)
  const [inPi, setInPi] = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)

  useEffect(() => {
    isPiBrowserReady(15_000).then(setInPi)
  }, [])

  useEffect(() => {
    if (!inPi || autoStarted.current) return
    autoStarted.current = true
    setAutoLoading(true)

    runPiAuthOnLoad()
      .then(() => setAutoLoading(false))
      .catch(() => setAutoLoading(false))
  }, [inPi])

  const showPiSignIn = inPi && status === 'unauthenticated'

  return (
    <>
      {children}
      {showPiSignIn && autoLoading && (
        <div
          className="fixed bottom-28 inset-x-4 z-[100] mx-auto max-w-sm rounded-xl bg-purple-900/90 border border-purple-500/30 px-4 py-3 text-center text-sm text-purple-100"
          role="status"
        >
          جاري تسجيل الدخول بـ Pi Network...
        </div>
      )}
      {showPiSignIn && (
        <div className="fixed bottom-6 inset-x-4 z-[100] mx-auto max-w-sm rounded-xl bg-slate-900/95 border border-white/10 p-3 shadow-xl">
          <PiLoginButton callbackUrl="/dashboard" compact disabled={autoLoading} />
        </div>
      )}
    </>
  )
}
