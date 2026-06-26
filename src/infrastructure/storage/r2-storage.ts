// =============================================================================
// src/infrastructure/storage/r2-storage.ts
// Production storage — Cloudflare R2 (S3-compatible)
// =============================================================================

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'
import {
  IFileStorage,
  UploadFileOptions,
  UploadedFile,
} from '@/core/interfaces/services/file-storage.interface'
import { StorageError } from '@/core/errors'

const MAX_DEFAULT_SIZE = 10 * 1024 * 1024 // 10MB

export class R2FileStorage implements IFileStorage {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly publicUrl: string

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    const bucket = process.env.R2_BUCKET_NAME
    const publicUrl = process.env.R2_PUBLIC_URL

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
      throw new Error('Missing R2 environment variables. Check R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL')
    }

    this.bucket = bucket
    this.publicUrl = publicUrl.replace(/\/$/, '')

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      // AWS SDK ≥3.729 sends checksum headers R2 does not support (501 NotImplemented)
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  }

  private generateKey(options: UploadFileOptions): string {
    const ext = this.getExtension(options.mimeType)
    const unique = crypto.randomUUID()
    const filename = options.filename
      ? `${options.filename}-${unique}.${ext}`
      : `${unique}.${ext}`
    return `${options.folder}/${filename}`
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

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: options.mimeType,
          // metadata للتتبع
          Metadata: {
            folder: options.folder,
            uploadedAt: new Date().toISOString(),
          },
        })
      )

      return {
        url: `${this.publicUrl}/${key}`,
        key,
        sizeBytes: buffer.byteLength,
        mimeType: options.mimeType,
      }
    } catch (err) {
      const detail =
        err && typeof err === 'object' && 'name' in err
          ? String((err as { name?: string; Code?: string }).name ?? (err as { Code?: string }).Code ?? '')
          : ''
      console.error('[R2Storage] Upload error:', detail, err)
      if (detail === 'AccessDenied' || detail === 'Forbidden') {
        throw new StorageError('رفض R2 الطلب — تحقق من صلاحيات API Token على الـ bucket')
      }
      if (detail === 'InvalidAccessKeyId' || detail === 'SignatureDoesNotMatch') {
        throw new StorageError('مفاتيح R2 غير صحيحة — راجع R2_ACCESS_KEY_ID و R2_SECRET_ACCESS_KEY')
      }
      if (detail === 'NoSuchBucket') {
        throw new StorageError('اسم الـ bucket غير موجود — راجع R2_BUCKET_NAME')
      }
      if (detail === 'NotImplemented') {
        throw new StorageError('R2 رفض الطلب (NotImplemented) — أعد المحاولة بعد تحديث التطبيق')
      }
      throw new StorageError('فشل رفع الملف إلى R2 — تحقق من إعدادات Cloudflare')
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
      )
    } catch (err) {
      console.error('[R2Storage] Delete error:', err)
      // لا نرمي خطأ عند الحذف — السجل قد يكون محذوفاً مسبقاً
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
      return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
    } catch (err) {
      console.error('[R2Storage] Signed URL error:', err)
      throw new StorageError('فشل إنشاء رابط الوصول المؤقت')
    }
  }
}
