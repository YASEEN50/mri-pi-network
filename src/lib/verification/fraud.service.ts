// src/lib/verification/fraud.service.ts
// كشف الاحتيال — 3 طبقات: SHA256 دقيق، pHash بصري، رقم الترخيص

import { createHash } from 'crypto'

// ─── pHash (Perceptual Hash) ──────────────────────────────────────────────────
// يُشبه الصور المتشابهة بصرياً حتى لو تغيّر الضغط أو الحجم

export async function computePHash(imageBuffer: Buffer): Promise<string> {
  try {
    const sharp = (await import('sharp')).default

    // تصغير الصورة لـ 8x8 grayscale — هذا جوهر pHash
    const small = await sharp(imageBuffer)
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer()

    // حساب متوسط قيم البكسل
    const avg = small.reduce((sum, v) => sum + v, 0) / small.length

    // بناء الـ hash: 1 إذا البكسل > المتوسط، 0 إذا أقل
    let bits = ''
    for (const pixel of small) {
      bits += pixel >= avg ? '1' : '0'
    }

    // تحويل bits لـ hex
    const hex = parseInt(bits, 2).toString(16).padStart(16, '0')
    return hex
  } catch {
    // fallback: SHA256 مقتطع
    return createHash('sha256').update(imageBuffer).digest('hex').slice(0, 16)
  }
}

// حساب Hamming Distance بين hash-ين
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64

  // تحويل hex → binary
  const binA = BigInt('0x' + a).toString(2).padStart(64, '0')
  const binB = BigInt('0x' + b).toString(2).padStart(64, '0')

  let dist = 0
  for (let i = 0; i < binA.length; i++) {
    if (binA[i] !== binB[i]) dist++
  }
  return dist
}

// ─── نتيجة الفحص ─────────────────────────────────────────────────────────────

export interface FraudCheckResult {
  checkType:       'SHA256_EXACT' | 'PHASH_SIMILAR' | 'LICENSE_DUPLICATE' | 'CLEAN'
  isFlagged:       boolean
  matchedDoctorId: string | null
  similarityScore: number      // 0-100
  riskFlags:       string[]
  details:         Record<string, unknown>
}

// ─── Fraud Detection Service ──────────────────────────────────────────────────

export class FraudDetectionService {

  // ── 1. فحص SHA256 — تطابق مثالي ──────────────────────────────────────────
  async checkExactDuplicate(params: {
    sha256Hash: string
    doctorId:   string
    imageType:  string
  }): Promise<FraudCheckResult> {
    try {
      // dynamic import لتجنب مشاكل circular dependencies
      const { db } = await import('@/lib/prisma')

      const existing = await db.fraudReference.findFirst({
        where: {
          sha256Hash: params.sha256Hash,
          isActive:   true,
          doctorId:   { not: params.doctorId }, // استثناء نفس الطبيب
        },
        select: { doctorId: true },
      }).catch(() => null)

      if (existing) {
        return {
          checkType:       'SHA256_EXACT',
          isFlagged:       true,
          matchedDoctorId: existing.doctorId,
          similarityScore: 100,
          riskFlags:       ['exact_duplicate_image', `matched_doctor:${existing.doctorId}`],
          details:         { sha256: params.sha256Hash },
        }
      }

      return {
        checkType: 'CLEAN', isFlagged: false,
        matchedDoctorId: null, similarityScore: 0, riskFlags: [], details: {},
      }
    } catch {
      return {
        checkType: 'CLEAN', isFlagged: false,
        matchedDoctorId: null, similarityScore: 0, riskFlags: [], details: { error: 'check_failed' },
      }
    }
  }

  // ── 2. فحص pHash — تشابه بصري ────────────────────────────────────────────
  async checkVisualDuplicate(params: {
    pHash:     string
    doctorId:  string
    imageType: string
  }): Promise<FraudCheckResult> {
    try {
      const { db } = await import('@/lib/prisma')

      // جلب كل الـ pHashes من نفس نوع الصورة
      const refs = await db.fraudReference.findMany({
        where: {
          imageType: params.imageType,
          isActive:  true,
          doctorId:  { not: params.doctorId },
        },
        select: { pHash: true, doctorId: true },
        take:   500, // حد معقول
      }).catch(() => [])

      let closestMatch: { doctorId: string; distance: number } | null = null
      const THRESHOLD = 8 // Hamming distance < 8 = مشبوه

      for (const ref of refs) {
        const dist = hammingDistance(params.pHash, ref.pHash)
        if (dist < THRESHOLD) {
          if (!closestMatch || dist < closestMatch.distance) {
            closestMatch = { doctorId: ref.doctorId, distance: dist }
          }
        }
      }

      if (closestMatch) {
        const similarity = Math.round((1 - closestMatch.distance / 64) * 100)
        return {
          checkType:       'PHASH_SIMILAR',
          isFlagged:       true,
          matchedDoctorId: closestMatch.doctorId,
          similarityScore: similarity,
          riskFlags:       ['visually_similar_image', `hamming_distance:${closestMatch.distance}`],
          details:         { pHash: params.pHash, hammingDistance: closestMatch.distance },
        }
      }

      return {
        checkType: 'CLEAN', isFlagged: false,
        matchedDoctorId: null, similarityScore: 0, riskFlags: [], details: {},
      }
    } catch {
      return {
        checkType: 'CLEAN', isFlagged: false,
        matchedDoctorId: null, similarityScore: 0, riskFlags: [], details: { error: 'check_failed' },
      }
    }
  }

  // ── 3. فحص رقم الترخيص — تكرار ──────────────────────────────────────────
  async checkLicenseDuplicate(params: {
    licenseNumber: string
    doctorId:      string  // DoctorProfile.id
  }): Promise<FraudCheckResult> {
    try {
      const { db } = await import('@/lib/prisma')

      const existing = await db.ocrResult.findFirst({
        where: {
          licenseNumber: params.licenseNumber,
          document: {
            doctorId: { not: params.doctorId },
          },
        },
        select: {
          document: { select: { doctorId: true } },
        },
      }).catch(() => null)

      if (existing?.document?.doctorId) {
        return {
          checkType:       'LICENSE_DUPLICATE',
          isFlagged:       true,
          matchedDoctorId: existing.document.doctorId,
          similarityScore: 100,
          riskFlags:       ['duplicate_license_number', `license:${params.licenseNumber}`],
          details:         { licenseNumber: params.licenseNumber },
        }
      }

      return {
        checkType: 'CLEAN', isFlagged: false,
        matchedDoctorId: null, similarityScore: 0, riskFlags: [], details: {},
      }
    } catch {
      return {
        checkType: 'CLEAN', isFlagged: false,
        matchedDoctorId: null, similarityScore: 0, riskFlags: [], details: { error: 'check_failed' },
      }
    }
  }

  // ── تسجيل مرجع في قاعدة البيانات بعد التحقق ──────────────────────────────
  async registerReference(params: {
    doctorId:   string
    documentId: string
    imageType:  string
    pHash:      string
    sha256Hash: string
  }): Promise<void> {
    try {
      const { db } = await import('@/lib/prisma')

      await db.fraudReference.upsert({
        where:  { sha256Hash: params.sha256Hash },
        update: { isActive: true },
        create: {
          doctorId:   params.doctorId,
          documentId: params.documentId,
          imageType:  params.imageType,
          pHash:      params.pHash,
          sha256Hash: params.sha256Hash,
          isActive:   true,
        },
      })
    } catch (e) {
      console.error('[FraudService] registerReference failed:', e)
    }
  }

  // ── حفظ نتيجة الفحص في DB ────────────────────────────────────────────────
  async saveCheckResult(params: {
    sessionId:  string
    doctorId:   string
    documentId: string
    result:     FraudCheckResult
  }): Promise<void> {
    if (params.result.checkType === 'CLEAN') return // لا نحفظ النظيف

    try {
      const { db } = await import('@/lib/prisma')

      await db.fraudCheck.create({
        data: {
          sessionId:       params.sessionId,
          doctorId:        params.doctorId,
          documentId:      params.documentId,
          checkType:       params.result.checkType,
          isFlagged:       params.result.isFlagged,
          matchedDoctorId: params.result.matchedDoctorId,
          similarityScore: params.result.similarityScore,
          riskFlags:       params.result.riskFlags,
        },
      })
    } catch (e) {
      console.error('[FraudService] saveCheckResult failed:', e)
    }
  }
}
