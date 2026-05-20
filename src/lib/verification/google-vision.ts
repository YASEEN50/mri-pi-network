// src/lib/verification/google-vision.ts
// Google Cloud Vision API — مهلة 10 ثوانٍ (لا Tesseract)

const VISION_TIMEOUT_MS = 10_000
const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate'

export interface VisionOcrResult {
  rawText:         string
  confidenceScore: number
}

export async function extractTextWithGoogleVision(
  imageBuffer: Buffer,
  mimeType:  string,
): Promise<VisionOcrResult> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_CLOUD_VISION_API_KEY is not configured')
  }

  if (mimeType === 'application/pdf') {
    console.warn('[google-vision] PDF: sync OCR غير مدعوم — ارفع صورة JPEG/PNG للرخصة')
    return { rawText: '', confidenceScore: 0 }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS)

  try {
    const res = await fetch(`${VISION_URL}?key=${encodeURIComponent(apiKey)}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body:    JSON.stringify({
        requests: [{
          image: { content: imageBuffer.toString('base64') },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
          imageContext: { languageHints: ['ar', 'en'] },
        }],
      }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`Vision API ${res.status}: ${errBody.slice(0, 200)}`)
    }

    const json = await res.json()
    const annotation = json?.responses?.[0]
    if (annotation?.error) {
      throw new Error(annotation.error.message ?? 'Vision API error')
    }

    const fullText =
      annotation?.fullTextAnnotation?.text ??
      annotation?.textAnnotations?.[0]?.description ??
      ''

    const confidences: number[] = (annotation?.textAnnotations ?? [])
      .slice(1)
      .map((t: { confidence?: number }) => t.confidence)
      .filter((c: number | undefined): c is number => typeof c === 'number')

    const avgConf = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : fullText.length > 20 ? 0.85 : 0.4

    return {
      rawText: fullText.trim(),
      confidenceScore: Math.round(Math.min(100, Math.max(0, avgConf * 100))),
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Google Vision timeout after ${VISION_TIMEOUT_MS}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
