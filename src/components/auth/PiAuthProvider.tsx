'use client'

/** Pi auth is triggered explicitly via PiLoginButton — not on every page load. */
export function PiAuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
