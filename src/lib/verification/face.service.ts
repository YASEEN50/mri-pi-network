// src/lib/verification/face.service.ts
// Face Verification — Strategy Pattern
// LocalFaceService: sharp (fallback)
// DeepFaceService: Python microservice on Railway (production)

import { createHash } from 'crypto'

// ─── Interface ────────────────────────────────────────────────────────────────

export interface FaceCompareResult {
  score:               number
  confidence:          'HIGH' | 'MEDIUM' | 'LOW' | 'UNDETECTABLE'
  facesDetected:       boolean
  serviceUsed:         string
  manualReviewRequired: boolean
  verified:            boolean
  details?:            Record<string, unknown>
}

export interface FaceService {
  compare(selfieBuffer: Buffer, idImageBuffer: Buffer): Promise<FaceCompareResult>
}

// ─── DeepFace Service (Production — Railway) ─────────────────────────────────

export class DeepFaceService implements FaceService {
  private serviceUrl:    string
  private serviceSecret: string

  constructor() {
    this.serviceUrl    = process.env.DEEPFACE_SERVICE_URL    ?? ''
    this.serviceSecret = process.env.DEEPFACE_SERVICE_SECRET ?? 'dev-face-secret'
  }

  async compare(selfieBuffer: Buffer, idImageBuffer: Buffer): Promise<FaceCompareResult> {
    if (!this.serviceUrl) {
      throw new Error('DEEPFACE_SERVICE_URL not configured')
    }

    // تحويل Buffer → base64
    const selfieBase64  = selfieBuffer.toString('base64')
    const idImageBase64 = idImageBuffer.toString('base64')

    const response = await fetch(`${this.serviceUrl}/compare`, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-service-secret':  this.serviceSecret,
      },
      body: JSON.stringify({ selfieBase64, idImageBase64 }),
      signal: AbortSignal.timeout(30000), // 30s timeout
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`DeepFace service error ${response.status}: ${errorText}`)
    }

    const result = await response.json()

    // إذا فشل اكتشاف الوجه
    if (!result.facesDetected || result.error) {
      return {
        score:               0,
        confidence:          'UNDETECTABLE',
        facesDetected:       false,
        serviceUsed:         'deepface-railway',
        manualReviewRequired: true,
        verified:            false,
        details:             { error: result.error, rawResult: result },
      }
    }

    const score = result.score ?? 0

    return {
      score,
      confidence:           score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW',
      facesDetected:        true,
      serviceUsed:          'deepface-railway',
      manualReviewRequired: true, // دائماً — الأدمن يقرر
      verified:             result.verified ?? false,
      details: {
        distance:  result.distance,
        threshold: result.threshold,
        model:     result.model,
      },
    }
  }
}

// ─── Local Service (Fallback — Sharp) ────────────────────────────────────────
// يُستخدم فقط إذا لم يكن DeepFace متاحاً
// دقته محدودة — مؤشر مساعد فقط

export class LocalFaceService implements FaceService {
  async compare(selfieBuffer: Buffer, idImageBuffer: Buffer): Promise<FaceCompareResult> {
    try {
      const sharp = (await import('sharp')).default
      const SIZE  = 64

      const [selfieData, idData] = await Promise.all([
        sharp(selfieBuffer).resize(SIZE, SIZE, { fit: 'cover' }).grayscale().raw().toBuffer(),
        sharp(idImageBuffer).resize(SIZE, SIZE, { fit: 'cover' }).grayscale().raw().toBuffer(),
      ])

      const histScore = this.histogramSimilarity(selfieData, idData)
      const ssimScore = this.ssim(selfieData, idData)
      const finalScore = Math.round((histScore * 0.4) + (ssimScore * 0.6))

      return {
        score:               finalScore,
        confidence:          'LOW', // دائماً LOW لأن هذا ليس face recognition حقيقي
        facesDetected:       true,
        serviceUsed:         'local-sharp-fallback',
        manualReviewRequired: true,
        verified:            false, // لا نعتمد هذا للقرار
        details:             {
          warning:   'This is a visual similarity score, NOT face recognition. Admin must verify manually.',
          histogram: histScore,
          ssim:      ssimScore,
        },
      }
    } catch (err) {
      return {
        score: 0, confidence: 'UNDETECTABLE', facesDetected: false,
        serviceUsed: 'local-failed', manualReviewRequired: true, verified: false,
        details: { error: err instanceof Error ? err.message : 'Unknown' },
      }
    }
  }

  private histogramSimilarity(a: Buffer, b: Buffer): number {
    const BINS = 32
    const hA = new Array(BINS).fill(0)
    const hB = new Array(BINS).fill(0)
    for (let i = 0; i < a.length; i++) {
      hA[Math.floor(a[i] / (256 / BINS))]++
      hB[Math.floor(b[i] / (256 / BINS))]++
    }
    let sum = 0
    for (let i = 0; i < BINS; i++) {
      sum += Math.sqrt((hA[i] / a.length) * (hB[i] / b.length))
    }
    return Math.round(sum * 100)
  }

  private ssim(a: Buffer, b: Buffer): number {
    const n = a.length
    let sA=0, sB=0, sA2=0, sB2=0, sAB=0
    for (let i = 0; i < n; i++) {
      const va=a[i]/255, vb=b[i]/255
      sA+=va; sB+=vb; sA2+=va*va; sB2+=vb*vb; sAB+=va*vb
    }
    const mA=sA/n, mB=sB/n
    const vA=(sA2/n)-mA*mA, vB=(sB2/n)-mB*mB, cov=(sAB/n)-mA*mB
    const C1=0.0001, C2=0.0009
    const ssim=((2*mA*mB+C1)*(2*cov+C2))/((mA*mA+mB*mB+C1)*(vA+vB+C2))
    return Math.round(Math.max(0, ssim) * 100)
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function getFaceService(): FaceService {
  if (process.env.DEEPFACE_SERVICE_URL) {
    console.log('[FaceService] Using DeepFace service on Railway')
    return new DeepFaceService()
  }
  console.log('[FaceService] Using local sharp fallback — deploy DeepFace for production')
  return new LocalFaceService()
}
