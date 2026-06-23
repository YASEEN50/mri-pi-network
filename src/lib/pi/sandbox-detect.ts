/** Pi Desktop App Studio preview needs sandbox:true even on production URLs */

export function detectPiSandboxClient(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const hostRef = `${window.location.hostname} ${document.referrer || ''}`
    if (/sandbox\.minepi/i.test(hostRef)) return true
    if (/\.pinet\.com$/i.test(window.location.hostname)) return false
  } catch { /* ignore */ }

  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  let embedded = false
  try {
    embedded = window.self !== window.top
  } catch {
    embedded = true
  }

  return embedded && !mobile
}

export async function resolvePiSandbox(): Promise<boolean> {
  const client = detectPiSandboxClient()
  try {
    const res = await fetch('/api/pi-config', { cache: 'no-store' })
    const data = await res.json()
    if (data.sandbox === true) return true
    return client
  } catch {
    return client
  }
}
