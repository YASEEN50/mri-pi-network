// src/lib/avatars/storage.ts

import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { getFileStorage } from '@/infrastructure/storage/storage.factory'
import type { AllowedMimeType } from '@/core/interfaces/services/file-storage.interface'

const LOCAL_DIR = join(process.cwd(), '.local-storage', 'avatars')

export async function saveAvatarFile(
  userId: string,
  buffer: Buffer,
  mimeType: AllowedMimeType,
): Promise<string> {
  const provider = process.env.STORAGE_PROVIDER ?? 'local'

  if (provider === 'r2') {
    const storage = getFileStorage()
    const uploaded = await storage.upload(buffer, {
      folder: 'avatars',
      mimeType,
      filename: userId,
    })
    return uploaded.url
  }

  const ext = mimeType === 'image/png' ? '.png' : '.jpg'
  const filename = `${userId}-${randomUUID()}${ext}`
  await mkdir(LOCAL_DIR, { recursive: true })
  await writeFile(join(LOCAL_DIR, filename), buffer)
  return `/api/avatars/${encodeURIComponent(filename)}`
}

export function avatarStorageUnavailableMessage(): string | null {
  const provider = process.env.STORAGE_PROVIDER ?? 'local'
  if (provider === 'r2') return null
  if (process.env.VERCEL === '1') {
    return 'رفع الصور غير متاح على الخادم — يُرجى تفعيل STORAGE_PROVIDER=r2 في Vercel'
  }
  return null
}
