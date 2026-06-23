/** Server-side Pi Platform API key (approve/complete). */
export function getPiNetworkApiKey(): string | undefined {
  return process.env.PI_NETWORK_API_KEY || process.env.PI_API_KEY || undefined
}

export function requirePiNetworkApiKey(): string {
  const key = getPiNetworkApiKey()
  if (!key) {
    throw new Error('PI_NETWORK_API_KEY is not set')
  }
  return key
}
