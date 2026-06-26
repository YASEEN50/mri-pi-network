// =============================================================================
// src/infrastructure/storage/storage.factory.ts
// Factory — يختار LocalStorage أو R2Storage حسب STORAGE_PROVIDER
// =============================================================================

import { IFileStorage } from '@/core/interfaces/services/file-storage.interface'
import { getMissingR2ClientEnvVars } from '@/lib/storage/r2-client'

let _instance: IFileStorage | null = null

export function getStorageProvider(): string {
  return (process.env.STORAGE_PROVIDER ?? 'local').trim().toLowerCase()
}

export function getMissingR2EnvVars(): string[] {
  return getMissingR2ClientEnvVars()
}

export function getFileStorage(): IFileStorage {
  if (_instance) return _instance

  const provider = getStorageProvider()

  if (provider === 'r2') {
    const missing = getMissingR2EnvVars()
    if (missing.length > 0) {
      throw new Error(`Missing R2 environment variables: ${missing.join(', ')}`)
    }
    const { R2FileStorage } = require('./r2-storage')
    _instance = new R2FileStorage()
  } else {
    const { LocalFileStorage } = require('./local-storage')
    _instance = new LocalFileStorage()
  }

  return _instance!
}
