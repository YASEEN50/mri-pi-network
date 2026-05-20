// src/lib/verification/ocr.service.ts
// Server-side ONLY — Google Cloud Vision (مهلة 10 ثوانٍ)

import { TextParser } from './text-parser'
import { extractTextWithGoogleVision } from './google-vision'
import type { OcrExtractedData } from './text-parser'

export type { OcrExtractedData }

export interface OcrInput {
  imageBuffer: Buffer
  doctorName:  string
  mimeType?:   string
}

export interface OcrResult {
  extractedData:   OcrExtractedData
  confidenceScore: number
  nameMatchScore:  number
  nameMatchStatus: 'MATCHED' | 'PARTIAL' | 'MISMATCH' | 'UNKNOWN'
  rawText:         string
  processingMs:    number
  provider:        'google_vision'
}

const OCR_TIMEOUT_MS = 10_000

export class OcrService {
  private parser = new TextParser()

  async processImage(input: OcrInput): Promise<OcrResult> {
    const startTime = Date.now()
    const mimeType  = input.mimeType ?? 'image/jpeg'

    const visionPromise = extractTextWithGoogleVision(input.imageBuffer, mimeType)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`OCR timeout after ${OCR_TIMEOUT_MS}ms`)),
        OCR_TIMEOUT_MS,
      ),
    )

    const vision = await Promise.race([visionPromise, timeoutPromise])
    const rawText         = vision.rawText
    const confidenceScore = vision.confidenceScore
    const extractedData   = this.parser.extractFields(rawText)

    const { score: nameMatchScore, status: nameMatchStatus } =
      this.compareNames(extractedData.name, input.doctorName)

    const processingMs = Date.now() - startTime
    console.log('[ocr-worker]', JSON.stringify({
      phase:      'google_vision_done',
      provider:   'google_vision',
      confidence: confidenceScore,
      nameMatch:  nameMatchStatus,
      ms:         processingMs,
    }))

    return {
      extractedData,
      confidenceScore,
      nameMatchScore,
      nameMatchStatus,
      rawText,
      processingMs,
      provider: 'google_vision',
    }
  }

  private compareNames(
    extractedName: string | null,
    doctorName:    string,
  ): { score: number; status: OcrResult['nameMatchStatus'] } {
    if (!extractedName) return { score: 0, status: 'UNKNOWN' }

    const normalize = (s: string) =>
      s.toLowerCase().replace(/\s+/g, ' ').trim()
        .replace(/[أإآ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/[هة]/g, 'ه')

    const a = normalize(extractedName)
    const b = normalize(doctorName)

    if (a === b)                        return { score: 100, status: 'MATCHED' }
    if (a.includes(b) || b.includes(a)) return { score: 85,  status: 'MATCHED' }

    const tokensA    = new Set(a.split(' '))
    const tokensB    = b.split(' ')
    const matchCount = tokensB.filter(t => tokensA.has(t)).length
    const score      = Math.round((matchCount / Math.max(tokensB.length, 1)) * 100)

    if (score >= 70) return { score, status: 'PARTIAL' }
    if (score >= 40) return { score, status: 'PARTIAL' }
    return { score, status: 'MISMATCH' }
  }
}
