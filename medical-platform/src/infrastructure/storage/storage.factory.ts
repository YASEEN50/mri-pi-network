// =============================================================================
// src/infrastructure/storage/storage.factory.ts
// Factory — يختار LocalStorage أو R2Storage حسب STORAGE_PROVIDER
// =============================================================================

import { IFileStorage } from '@/core/interfaces/services/file-storage.interface'

let _instance: IFileStorage | null = null

export function getFileStorage(): IFileStorage {
  if (_instance) return _instance

  const provider = process.env.STORAGE_PROVIDER ?? 'local'

  if (provider === 'r2') {
    const { R2FileStorage } = require('./r2-storage')
    _instance = new R2FileStorage()
  } else {
    const { LocalFileStorage } = require('./local-storage')
    _instance = new LocalFileStorage()
  }

  return _instance!
}
