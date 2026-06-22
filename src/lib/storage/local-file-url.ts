// src/lib/storage/local-file-url.ts
/** رابط عرض ملف محلي مخزّن في .local-storage */
export function localFileUrl(storageKey: string): string {
  const encoded = storageKey.split('/').map(encodeURIComponent).join('/')
  return `/api/files/${encoded}`
}

export function isServeableStorageKey(key: string): boolean {
  return /^(license|credential|dataflow|selfie|id-doc|id|facility-docs|avatars)\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|pdf|webp)$/i.test(key)
}

/** يحوّل مفتاح تخزين أو رابط محلي إلى URL قابل للعرض */
export function resolveStoredDocUrl(url: string | null | undefined): string | null {
  if (!url || isPlaceholderUrl(url)) return null
  if (url.startsWith('/api/files/')) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.includes('/')) return localFileUrl(url)
  return null
}

export function inferMimeFromUrl(url: string): string | null {
  const lower = url.split('?')[0].toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return null
}

export function isPlaceholderUrl(url: string | null | undefined): boolean {
  if (!url) return true
  return url.includes('placeholder.com') || url.trim() === ''
}
