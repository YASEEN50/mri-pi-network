'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { Role } from '@prisma/client'
import {
  isPiBrowser,
  markPiSessionRedirect,
  requestPiCookieAccess,
} from '@/lib/pi/pi-auth-client'

type Options = {
  redirectTo?: string
  roles?: Role[]
  onRoleMismatch?: string
}

/**
 * Wait for Pi cookie bootstrap, retry session once, then redirect to login if still unauthenticated.
 */
export function useRequireAuth(options: Options = {}) {
  const { redirectTo = '/login', roles, onRoleMismatch = '/' } = options
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    let active = true

    ;(async () => {
      if (status === 'authenticated' && session?.user) {
        if (roles && !roles.includes(session.user.role)) {
          router.replace(onRoleMismatch)
          return
        }
        if (active) setChecked(true)
        return
      }

      if (status === 'unauthenticated' && isPiBrowser()) {
        await requestPiCookieAccess()
        const refreshed = await update()
        if (active && refreshed?.user) {
          if (roles && !roles.includes(refreshed.user.role)) {
            router.replace(onRoleMismatch)
            return
          }
          setChecked(true)
          return
        }
      }

      if (active && status === 'unauthenticated') {
        markPiSessionRedirect()
        router.replace(redirectTo)
        return
      }

      if (active) setChecked(true)
    })()

    return () => {
      active = false
    }
  }, [status, session, update, router, redirectTo, onRoleMismatch, roles])

  return {
    session,
    status,
    isLoading: status === 'loading' || !checked,
    isAuthenticated: status === 'authenticated' && checked,
  }
}
