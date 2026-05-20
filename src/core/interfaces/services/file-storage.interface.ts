// =============================================================================
// src/core/interfaces/services/file-storage.interface.ts
// =============================================================================

export type AllowedMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'application/pdf'

export interface UploadFileOptions {
  folder: 'licenses' | 'credentials' | 'avatars' | 'facility-docs' | 'covers'
  filename?: string          // اختياري — يُولَّد تلقائياً إذا لم يُحدد
  mimeType: AllowedMimeType
  maxSizeBytes?: number      // الافتراضي: 10MB
}

export interface UploadedFile {
  url: string        // الرابط العام
  key: string        // المفتاح في Storage (للحذف لاحقاً)
  sizeBytes: number
  mimeType: string
}

export interface IFileStorage {
  /**
   * رفع ملف من Buffer
   */
  upload(buffer: Buffer, options: UploadFileOptions): Promise<UploadedFile>

  /**
   * حذف ملف بالمفتاح
   */
  delete(key: string): Promise<void>

  /**
   * الحصول على رابط مؤقت (للملفات الخاصة)
   */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>
}
