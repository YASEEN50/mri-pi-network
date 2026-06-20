// Server-side Pi access token validation — GET /v2/me (Bearer only, no API key)

export interface PiMeResponse {
  uid:      string
  username: string
}

export async function verifyPiAccessToken(
  accessToken: string,
): Promise<PiMeResponse | null> {
  if (!accessToken?.trim()) return null

  try {
    const res = await fetch('https://api.minepi.com/v2/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error('[Pi Auth] /v2/me failed:', res.status)
      return null
    }

    const data = await res.json()
    if (!data?.uid || !data?.username) return null

    return { uid: String(data.uid), username: String(data.username) }
  } catch (err) {
    console.error('[Pi Auth] verifyPiAccessToken error:', err)
    return null
  }
}
