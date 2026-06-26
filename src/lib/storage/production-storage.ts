import { getStorageProvider } from '@/infrastructure/storage/storage.factory'
import type { AllowedMimeType, UploadFileOptions } from '@/core/interfaces/services/file-storage.interface'
import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  downloadFile,
  getMissingR2ClientEnvVars,
  uploadFile,
} from '@/lib/storage/r2-client'

export function productionStorageBlockedMessage(): string | null {
  const provider = getStorageProvider()

  if (provider === 'r2') {
    const missing = getMissingR2ClientEnvVars()
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

export function getActiveStorageBucket(): 'local' | 'r2' {
  return getStorageProvider() === 'r2' ? 'r2' : 'local'
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
}

/** Map IFileStorage folder names to legacy local/R2 key prefixes. */
const FOLDER_ALIASES: Record<string, string> = {
  licenses: 'license',
  credentials: 'credential',
}

function resolveStorageFolder(folder: string): string {
  return FOLDER_ALIASES[folder] ?? folder
}

function localFilesUrl(storageKey: string): string {
  return `/api/files/${storageKey.split('/').map(encodeURIComponent).join('/')}`
}

export async function saveBufferByKey(
  buffer: Buffer,
  storageKey: string,
  mimeType: AllowedMimeType,
): Promise<{ url: string; key: string; bucket: 'local' | 'r2' }> {
  const key = storageKey.replace(/^\/+/, '')

  if (getStorageProvider() === 'r2') {
    const uploaded = await uploadFile({
      key,
      body: buffer,
      contentType: mimeType,
    })
    return { url: uploaded.url, key: uploaded.key, bucket: 'r2' }
  }

  const localDir = join(process.cwd(), '.local-storage', key.split('/')[0] ?? '')
  await mkdir(localDir, { recursive: true })
  await writeFile(join(process.cwd(), '.local-storage', key), buffer)
  return { url: localFilesUrl(key), key, bucket: 'local' }
}

export async function readBufferByKey(
  storageKey: string,
  storageBucket?: string | null,
): Promise<Buffer> {
  const key = storageKey.replace(/^\/+/, '')
  const useR2 = storageBucket === 'r2' || (storageBucket !== 'local' && getStorageProvider() === 'r2')

  if (useR2) {
    return downloadFile(key)
  }

  return readFile(join(process.cwd(), '.local-storage', key))
}

export async function saveUploadedFile(
  buffer: Buffer,
  options: UploadFileOptions,
): Promise<string> {
  const folder = resolveStorageFolder(options.folder)
  const ext = MIME_EXT[options.mimeType] ?? '.bin'
  const filename = options.filename
    ? `${options.filename}-${randomUUID()}${ext}`
    : `${randomUUID()}${ext}`
  const storageKey = `${folder}/${filename}`

  const saved = await saveBufferByKey(buffer, storageKey, options.mimeType)
  return saved.url
}
