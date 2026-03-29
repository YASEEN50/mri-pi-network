// =============================================================================
// src/infrastructure/storage/local-storage.ts
// Development storage — saves files to ./uploads/ on disk
// =============================================================================

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import {
  IFileStorage,
  UploadFileOptions,
  UploadedFile,
} from '@/core/interfaces/services/file-storage.interface'
import { StorageError } from '@/core/errors'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const MAX_DEFAULT_SIZE = 10 * 1024 * 1024 // 10MB

export class LocalFileStorage implements IFileStorage {
  private readonly baseUrl: string

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  }

  private async ensureDir(folder: string): Promise<string> {
    const dir = path.join(UPLOAD_DIR, folder)
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  private generateFilename(options: UploadFileOptions): string {
    const ext = this.getExtension(options.mimeType)
    const unique = crypto.randomUUID()
    return options.filename
      ? `${options.filename}-${unique}.${ext}`
      : `${unique}.${ext}`
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

    try {
      const dir = await this.ensureDir(options.folder)
      const filename = this.generateFilename(options)
      const filePath = path.join(dir, filename)
      const key = `${options.folder}/${filename}`

      await fs.writeFile(filePath, buffer)

      return {
        url: `${this.baseUrl}/api/uploads/${key}`,
        key,
        sizeBytes: buffer.byteLength,
        mimeType: options.mimeType,
      }
    } catch (err) {
      throw new StorageError('فشل حفظ الملف على القرص')
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = path.join(UPLOAD_DIR, key)
      await fs.unlink(filePath)
    } catch {
      // تجاهل إذا الملف غير موجود
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    // في البيئة المحلية، نُرجع رابطاً مباشراً مع token مؤقت
    const token = crypto
      .createHmac('sha256', process.env.NEXTAUTH_SECRET ?? 'dev-secret')
      .update(`${key}:${Date.now() + expiresInSeconds * 1000}`)
      .digest('hex')

    return `${this.baseUrl}/api/uploads/${key}?token=${token}`
  }
}
