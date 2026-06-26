import {
  getFileStorage,
  getMissingR2EnvVars,
  getStorageProvider,
} from '@/infrastructure/storage/storage.factory'
import type { AllowedMimeType, UploadFileOptions } from '@/core/interfaces/services/file-storage.interface'
import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

export function productionStorageBlockedMessage(): string | null {
  const provider = getStorageProvider()

  if (provider === 'r2') {
    const missing = getMissingR2EnvVars()
    if (missing.length > 0) {
      return `إعدادات R2 ناقصة في Vercel: ${missing.join(', ')}`
    }
    return null
  }

  if (process.env.VERCEL === '1') {
    return 'رفع الملفات غير متاح — عيّن STORAGE_PROVIDER=r2 في Vercel'
  }

  return null
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
}

function localFilesUrl(storageKey: string): string {
  return `/api/files/${storageKey.split('/').map(encodeURIComponent).join('/')}`
}

export async function saveUploadedFile(
  buffer: Buffer,
  options: UploadFileOptions,
): Promise<string> {
  const provider = getStorageProvider()

  if (provider === 'r2') {
    const storage = getFileStorage()
    const uploaded = await storage.upload(buffer, options)
    return uploaded.url
  }

  const ext = MIME_EXT[options.mimeType] ?? '.bin'
  const filename = options.filename
    ? `${options.filename}-${randomUUID()}${ext}`
    : `${randomUUID()}${ext}`
  const storageKey = `${options.folder}/${filename}`
  const localDir = join(process.cwd(), '.local-storage', options.folder)

  await mkdir(localDir, { recursive: true })
  await writeFile(join(process.cwd(), '.local-storage', storageKey), buffer)
  return localFilesUrl(storageKey)
}
