// src/lib/medical-records/storage.ts

import { mkdir, writeFile, readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { getFileStorage } from '@/infrastructure/storage/storage.factory'
import type { AllowedMimeType } from '@/core/interfaces/services/file-storage.interface'

const LOCAL_DIR = join(process.cwd(), '.local-storage', 'medical-records')

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
}

export function medicalRecordFileUrl(recordId: string): string {
  return `/api/medical-records/${recordId}/file`
}

function storageKey(recordId: string, mime: string): string {
  const ext = MIME_EXT[mime] ?? '.bin'
  return `medical-records/${recordId}${ext}`
}

export async function saveMedicalRecordFile(
  recordId: string,
  buffer: Buffer,
  mime: AllowedMimeType
): Promise<void> {
  const provider = process.env.STORAGE_PROVIDER ?? 'local'

  if (provider === 'r2') {
    const storage = getFileStorage()
    await storage.upload(buffer, {
      folder: 'medical-records',
      mimeType: mime,
      filename: recordId,
    })
    return
  }

  await mkdir(LOCAL_DIR, { recursive: true })
  const ext = MIME_EXT[mime] ?? '.bin'
  await writeFile(join(LOCAL_DIR, `${recordId}${ext}`), buffer)
}

export async function readMedicalRecordFile(
  recordId: string,
  mime: string | null | undefined
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const provider = process.env.STORAGE_PROVIDER ?? 'local'
  const contentType = mime ?? 'application/octet-stream'

  if (provider === 'r2') {
    const storage = getFileStorage()
    const key = storageKey(recordId, contentType)
    const url = await storage.getSignedUrl(key, 300)
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    return { buffer, contentType: res.headers.get('content-type') ?? contentType }
  }

  for (const ext of ['.pdf', '.jpg', '.png']) {
    try {
      const buffer = await readFile(join(LOCAL_DIR, `${recordId}${ext}`))
      const ct =
        ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg'
      return { buffer, contentType: ct }
    } catch {
      /* try next ext */
    }
  }
  return null
}

export async function deleteMedicalRecordFile(recordId: string, mime?: string | null): Promise<void> {
  const provider = process.env.STORAGE_PROVIDER ?? 'local'

  if (provider === 'r2' && mime) {
    const storage = getFileStorage()
    await storage.delete(storageKey(recordId, mime))
    return
  }

  for (const ext of ['.pdf', '.jpg', '.png']) {
    try {
      await unlink(join(LOCAL_DIR, `${recordId}${ext}`))
    } catch {
      /* ignore */
    }
  }
}
