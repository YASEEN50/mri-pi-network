'use client'
// src/components/common/SessionProvider.tsx
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { PiSessionGate } from '@/components/auth/PiSessionGate'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <PiSessionGate>{children}</PiSessionGate>
    </NextAuthSessionProvider>
  )
}
