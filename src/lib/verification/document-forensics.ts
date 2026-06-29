/** Document forensics — metadata & integrity signals (not legal proof of forgery). */

export interface ForensicsSignal {
  code: string
  label: string
  weight: number
}

export interface DocumentForensicsResult {
  score: number
  signals: ForensicsSignal[]
  details: {
    declaredMime: string
    detectedFormat: string | null
    width: number | null
    height: number | null
    fileSizeBytes: number
  }
}

const SIGNAL_LABELS: Record<string, string> = {
  mime_format_mismatch: 'نوع الملف المُعلَن لا يطابق المحتوى الفعلي',
  image_too_small: 'دقة الصورة منخفضة جداً (قد تكون لقطة شاشة أو نسخة رديئة)',
  low_resolution: 'حجم الصورة صغير — صعب التحقق من التفاصيل',
  editing_software_detected: 'بيانات EXIF تشير لبرنامج تعديل (Photoshop/GIMP/Canva…)',
  suspicious_recompression: 'ضغط غير طبيعي — احتمال إعادة حفظ أو تعديل',
  invalid_document_format: 'صيغة ملف غير مناسبة للشهادة/الرخصة',
  pdf_certificate: 'ملف PDF — راجع أصل المستند يدوياً',
}

function detectFormat(buffer: Buffer): string | null {
  if (buffer.length < 4) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'png'
  if (buffer.slice(0, 4).toString('ascii') === '%PDF') return 'pdf'
  if (buffer.slice(0, 3).toString('ascii') === 'GIF') return 'gif'
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'webp'
  }
  return null
}

function mimeToFormat(mime: string): string | null {
  const m = mime.toLowerCase()
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpeg'
  if (m.includes('png')) return 'png'
  if (m.includes('pdf')) return 'pdf'
  if (m.includes('webp')) return 'webp'
  if (m.includes('gif')) return 'gif'
  return null
}

function scanExifForEditingSoftware(exifBuffer: Buffer | undefined): boolean {
  if (!exifBuffer?.length) return false
  const text = exifBuffer.toString('latin1')
  return /photoshop|adobe|gimp|canva|snapseed|lightroom|pixelmator|affinity|paint\.net/i.test(text)
}

export async function analyzeDocumentForensics(
  buffer: Buffer,
  declaredMime: string,
  docType: string,
): Promise<DocumentForensicsResult> {
  const signals: ForensicsSignal[] = []
  const detectedFormat = detectFormat(buffer)
  const declaredFormat = mimeToFormat(declaredMime)
  const fileSizeBytes = buffer.length

  if (detectedFormat && declaredFormat && detectedFormat !== declaredFormat) {
    signals.push({
      code: 'mime_format_mismatch',
      label: SIGNAL_LABELS.mime_format_mismatch,
      weight: 35,
    })
  }

  const credentialTypes = ['LICENSE', 'CREDENTIAL', 'DATAFLOW', 'ID_DOCUMENT']
  if (credentialTypes.includes(docType) && detectedFormat === 'pdf') {
    signals.push({
      code: 'pdf_certificate',
      label: SIGNAL_LABELS.pdf_certificate,
      weight: 15,
    })
  }

  if (credentialTypes.includes(docType) && !detectedFormat) {
    signals.push({
      code: 'invalid_document_format',
      label: SIGNAL_LABELS.invalid_document_format,
      weight: 40,
    })
  }

  let width: number | null = null
  let height: number | null = null

  if (detectedFormat && detectedFormat !== 'pdf') {
    try {
      const sharp = (await import('sharp')).default
      const meta = await sharp(buffer).metadata()
      width = meta.width ?? null
      height = meta.height ?? null

      if (meta.exif && scanExifForEditingSoftware(meta.exif)) {
        signals.push({
          code: 'editing_software_detected',
          label: SIGNAL_LABELS.editing_software_detected,
          weight: 45,
        })
      }

      if (width && height) {
        const pixels = width * height
        const minSide = Math.min(width, height)

        if (minSide < 400 && docType !== 'SELFIE') {
          signals.push({
            code: 'image_too_small',
            label: SIGNAL_LABELS.image_too_small,
            weight: 30,
          })
        }
        if (pixels < 200_000 && docType !== 'SELFIE') {
          signals.push({
            code: 'low_resolution',
            label: SIGNAL_LABELS.low_resolution,
            weight: 20,
          })
        }

        if (pixels > 0 && fileSizeBytes > 0) {
          const bytesPerPixel = fileSizeBytes / pixels
          if (bytesPerPixel < 0.08 && fileSizeBytes > 20_000) {
            signals.push({
              code: 'suspicious_recompression',
              label: SIGNAL_LABELS.suspicious_recompression,
              weight: 25,
            })
          }
        }
      }
    } catch {
      /* sharp unavailable or corrupt image */
    }
  }

  const score = Math.min(100, signals.reduce((sum, s) => sum + s.weight, 0))

  return {
    score,
    signals,
    details: {
      declaredMime,
      detectedFormat,
      width,
      height,
      fileSizeBytes,
    },
  }
}

export function forensicsFlagReason(signals: ForensicsSignal[]): string {
  if (signals.length === 0) return ''
  return signals.map((s) => s.label).join(' · ')
}

/** Human-readable labels for admin UI */
export function forensicsSignalLabel(code: string): string {
  return SIGNAL_LABELS[code] ?? code
}
