/** Pi Browser embeds apps in a cross-site iframe — needs SameSite=None cookies. */
export function useCrossSiteAuthCookies(): boolean {
  if (process.env.NEXTAUTH_CROSS_SITE === 'true') return true
  if (process.env.NODE_ENV === 'production') return true
  const url = process.env.NEXTAUTH_URL ?? ''
  return url.startsWith('https://')
}

export const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60

export function sessionCookieName(): string {
  return useCrossSiteAuthCookies()
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SEC) {
  const crossSite = useCrossSiteAuthCookies()
  const partitioned = crossSite && process.env.NEXTAUTH_COOKIE_PARTITIONED !== 'false'
  return {
    httpOnly: true,
    secure: crossSite || process.env.NODE_ENV === 'production',
    sameSite: (crossSite ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge,
    ...(partitioned ? { partitioned: true as const } : {}),
  }
}
