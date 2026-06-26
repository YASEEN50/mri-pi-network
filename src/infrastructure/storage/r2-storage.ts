// =============================================================================
// src/infrastructure/storage/r2-storage.ts
// Production storage — Cloudflare R2 (S3-compatible)
// =============================================================================

import crypto from 'crypto'
import {
  IFileStorage,
  UploadFileOptions,
  UploadedFile,
} from '@/core/interfaces/services/file-storage.interface'
import { StorageError } from '@/core/errors'
import { uploadFile, deleteFile } from '@/lib/storage/r2-client'

const MAX_DEFAULT_SIZE = 10 * 1024 * 1024 // 10MB

const FOLDER_ALIASES: Record<string, string> = {
  licenses: 'license',
  credentials: 'credential',
}

export class R2FileStorage implements IFileStorage {
  private generateKey(options: UploadFileOptions): string {
    const ext = this.getExtension(options.mimeType)
    const unique = crypto.randomUUID()
    const folder = FOLDER_ALIASES[options.folder] ?? options.folder
    const filename = options.filename
      ? `${options.filename}-${unique}.${ext}`
      : `${unique}.${ext}`
    return `${folder}/${filename}`
  }

  private getExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    }
    return map[mimeType] ?? 'bin'
  }

  async upload(buffer: Buffer, options: UploadFileOptions): Promise<UploadedFile> {
    const maxSize = options.maxSizeBytes ?? MAX_DEFAULT_SIZE
    if (buffer.byteLength > maxSize) {
      throw new StorageError(`حجم الملف يتجاوز الحد المسموح (${maxSize / 1024 / 1024}MB)`)
    }

    const key = this.generateKey(options)
    const uploaded = await uploadFile({
      key,
      body: buffer,
      contentType: options.mimeType,
    })

    return {
      url: uploaded.url,
      key: uploaded.key,
      sizeBytes: buffer.byteLength,
      mimeType: options.mimeType,
    }
  }

  async delete(key: string): Promise<void> {
    await deleteFile(key)
  }

  async getSignedUrl(key: string): Promise<string> {
    const { getR2PublicUrl } = await import('@/lib/storage/r2-client')
    return `${getR2PublicUrl()}/${key.replace(/^\/+/, '')}`
  }
}
