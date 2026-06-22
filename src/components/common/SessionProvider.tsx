'use client'
// src/components/common/SessionProvider.tsx
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider refetchOnWindowFocus={true}>
      {children}
    </NextAuthSessionProvider>
  )
}
