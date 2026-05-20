// src/lib/verification/file-validator.ts
// Magic bytes validation — never trust file extension or MIME from client

export interface FileValidationResult {
  valid:    boolean
  mimeType: string | null
  error?:   string
}

// Magic bytes signatures for allowed types
const MAGIC_BYTES: Array<{ bytes: number[]; mime: string }> = [
  { bytes: [0xFF, 0xD8, 0xFF, 0xE0], mime: 'image/jpeg' },
  { bytes: [0xFF, 0xD8, 0xFF, 0xE1], mime: 'image/jpeg' },
  { bytes: [0xFF, 0xD8, 0xFF, 0xDB], mime: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mime: 'image/png' },
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf' },
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MIN_FILE_SIZE = 5 * 1024          // 5KB

export function validateFileBuffer(buffer: Buffer): FileValidationResult {
  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, mimeType: null, error: 'حجم الملف يتجاوز 10MB' }
  }
  if (buffer.length < MIN_FILE_SIZE) {
    return { valid: false, mimeType: null, error: 'الملف صغير جداً — تأكد من صحة الملف' }
  }

  for (const sig of MAGIC_BYTES) {
    const fileBytes = Array.from(buffer.subarray(0, sig.bytes.length))
    if (sig.bytes.every((byte, i) => fileBytes[i] === byte)) {
      return { valid: true, mimeType: sig.mime }
    }
  }

  return {
    valid:    false,
    mimeType: null,
    error:    'نوع الملف غير مقبول — يُقبل فقط JPEG و PNG و PDF',
  }
}
