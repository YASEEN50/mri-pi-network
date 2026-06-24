/** JSON-safe serialization for GDPR data exports (Dates, Decimals) */

export function toExportJson(data: unknown): string {
  return JSON.stringify(
    data,
    (_, value) => {
      if (value instanceof Date) return value.toISOString()
      if (
        value !== null &&
        typeof value === 'object' &&
        typeof (value as { toFixed?: unknown }).toFixed === 'function'
      ) {
        return (value as { toString(): string }).toString()
      }
      return value
    },
    2,
  )
}

export function exportFilename(userId: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `mri-data-export-${userId.slice(0, 8)}-${stamp}.json`
}
