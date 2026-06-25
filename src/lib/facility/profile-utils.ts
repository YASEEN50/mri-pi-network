/** Normalize user-entered website to https URL or null */
export function normalizeWebsite(url?: string | null): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function buildFacilityMediaUrl(storageKey: string): string {
  return `/api/files/${storageKey.split('/').map(encodeURIComponent).join('/')}`
}
