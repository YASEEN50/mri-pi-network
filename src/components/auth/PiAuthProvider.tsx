'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  isPiBrowserReady,
  signInWithPiNetwork,
  shouldSkipPiAutoLogin,
  clearExplicitLogout,
} from '@/lib/pi/pi-auth-client'
import PiLoginButton from '@/components/auth/PiLoginButton'

export function PiAuthProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const router = useRouter()
  const autoStarted = useRef(false)
  const [inPi, setInPi] = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)

  useEffect(() => {
    isPiBrowserReady().then(setInPi)
  }, [])

  useEffect(() => {
    if (!inPi || status !== 'unauthenticated') return
    if (shouldSkipPiAutoLogin() || autoStarted.current) return
    autoStarted.current = true
    setAutoLoading(true)

    signInWithPiNetwork()
      .then((result) => {
        setAutoLoading(false)
        if (result.ok) {
          clearExplicitLogout()
          router.push('/dashboard')
          router.refresh()
        }
      })
      .catch(() => {
        setAutoLoading(false)
      })
  }, [inPi, status, router])

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
