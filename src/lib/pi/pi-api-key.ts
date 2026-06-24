/** Server-side Pi Platform API key (approve/complete/KYC). Accepts either env name. */
export function getPiNetworkApiKey(): string | undefined {
  const key = process.env.PI_NETWORK_API_KEY || process.env.PI_API_KEY
  return key?.trim() || undefined
}

export function isPiPaymentsConfigured(): boolean {
  return !!getPiNetworkApiKey()
}

export function isPiSandboxMode(): boolean {
  return process.env.PI_SANDBOX === 'true' || process.env.NEXT_PUBLIC_PI_SANDBOX === 'true'
}

export const PI_PAYMENTS_NOT_CONFIGURED_MSG =
  'مفتاح Pi غير مُعدّ على الخادم. أضف PI_API_KEY أو PI_NETWORK_API_KEY في Vercel.'

export function requirePiNetworkApiKey(): string {
  const key = getPiNetworkApiKey()
  if (!key) {
    throw new Error(PI_PAYMENTS_NOT_CONFIGURED_MSG)
  }
  return key
}
