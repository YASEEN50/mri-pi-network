// src/lib/verification/text-parser.ts
// Extracts structured fields from raw OCR text
// Handles Arabic and English license formats

export interface OcrExtractedData {
  name:          string | null
  licenseNumber: string | null
  specialty:     string | null
  expiryDate:    string | null
  issueDate:     string | null
}

export class TextParser {

  extractFields(rawText: string): OcrExtractedData {
    return {
      name:          this.extractName(rawText),
      licenseNumber: this.extractLicenseNumber(rawText),
      specialty:     this.extractSpecialty(rawText),
      expiryDate:    this.extractExpiryDate(rawText),
      issueDate:     this.extractIssueDate(rawText),
    }
  }

  private extractName(text: string): string | null {
    const patterns = [
      /(?:اسم الطبيب|الاسم الكامل|الاسم)\s*[:：]\s*([^\n\r]{3,80})/i,
      /(?:doctor'?s?\s+name|full\s+name|name)\s*[:：]\s*([A-Za-z\s]{3,80})/i,
      /(?:د\.?|Dr\.?)\s+([A-Za-zأ-ي\s]{3,60})/,
    ]
    for (const p of patterns) {
      const m = text.match(p)
      if (m?.[1]) return m[1].trim().replace(/\s+/g, ' ')
    }
    return null
  }

  private extractLicenseNumber(text: string): string | null {
    const patterns = [
      /(?:رقم الترخيص|رقم الممارسة|رقم الرخصة)\s*[:：]?\s*([A-Za-z0-9\-\/]{4,20})/i,
      /(?:license\s*(?:no|number|#))\s*[:：]?\s*([A-Za-z0-9\-\/]{4,20})/i,
      /\b([0-9]{5,8})\b/,
    ]
    for (const p of patterns) {
      const m = text.match(p)
      if (m?.[1]) return m[1].trim()
    }
    return null
  }

  private extractSpecialty(text: string): string | null {
    const patterns = [
      /(?:التخصص|تخصص)\s*[:：]\s*([^\n\r]{3,100})/i,
      /(?:specialty|specialization)\s*[:：]\s*([A-Za-z\s]{3,80})/i,
    ]
    for (const p of patterns) {
      const m = text.match(p)
      if (m?.[1]) return m[1].trim()
    }
    return null
  }

  private extractExpiryDate(text: string): string | null {
    return this.extractDate(text, [
      /(?:تاريخ انتهاء|صالح حتى|ينتهي في)\s*[:：]?\s*/i,
      /(?:expiry\s*date|expires|valid\s*until)\s*[:：]?\s*/i,
    ])
  }

  private extractIssueDate(text: string): string | null {
    return this.extractDate(text, [
      /(?:تاريخ الإصدار|تاريخ المنح)\s*[:：]?\s*/i,
      /(?:issue\s*date|issued\s*on)\s*[:：]?\s*/i,
    ])
  }

  private extractDate(text: string, prefixes: RegExp[]): string | null {
    const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/
    for (const prefix of prefixes) {
      const combined = new RegExp(prefix.source + datePattern.source, 'i')
      const m = text.match(combined)
      if (m?.[1]) return this.normalizeDate(m[1])
    }
    return null
  }

  private normalizeDate(raw: string): string {
    const parts = raw.split(/[\/\-\.]/)
    if (parts.length !== 3) return raw
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`
    }
    const year = parts[2].length === 2 ? '20' + parts[2] : parts[2]
    return `${year}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
  }
}
