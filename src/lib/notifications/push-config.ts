/** Pi Browser push — Web Notifications + polling (Pi SDK has no server push API) */

export const PI_PUSH_POLL_VISIBLE_MS = 8_000
export const PI_PUSH_POLL_HIDDEN_MS = 3_000
export const PI_PUSH_SEEN_KEY = 'mri_push_seen_ids'
export const PI_PUSH_ENABLED_KEY = 'mri_push_enabled'

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function isPushEnabledByUser(): boolean {
  try {
    return localStorage.getItem(PI_PUSH_ENABLED_KEY) !== 'false'
  } catch {
    return true
  }
}

export function setPushEnabledByUser(enabled: boolean): void {
  try {
    localStorage.setItem(PI_PUSH_ENABLED_KEY, enabled ? 'true' : 'false')
  } catch { /* ignore */ }
}

export function loadSeenPushIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(PI_PUSH_SEEN_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

export function saveSeenPushIds(ids: Set<string>): void {
  try {
    const trimmed = [...ids].slice(-100)
    sessionStorage.setItem(PI_PUSH_SEEN_KEY, JSON.stringify(trimmed))
  } catch { /* ignore */ }
}
