// src/lib/verification/score.engine.ts
// حساب درجة المخاطرة النهائية — يُستخدم لترتيب قائمة الأدمن

export interface ScoreInput {
  ocrConfidence:   number  // 0-100: ثقة Tesseract في استخراج البيانات
  nameMatchScore:  number  // 0-100: تطابق الاسم مع الرخصة
  faceMatchScore:  number  // 0-100: تطابق الوجه
  fraudFlags:      number  // عدد علامات الاحتيال (0, 1, 2, ...)
  documentsCount:  number  // عدد الشهادات المرفوعة (>=1 أفضل)
}

export interface ScoreResult {
  finalScore:    number            // 0-100 (كلما أعلى كلما أفضل)
  riskLevel:     'LOW' | 'MEDIUM' | 'HIGH'
  adminPriority: number            // 1=أعلى أولوية (HIGH risk أولاً)
  breakdown:     Record<string, number>
  recommendation: string
}

const WEIGHTS = {
  ocr:       0.25,   // ثقة OCR
  nameMatch: 0.25,   // تطابق الاسم
  face:      0.35,   // تطابق الوجه (الأهم)
  documents: 0.15,   // توثيق الشهادات
}

export class ScoreEngine {

  calculate(input: ScoreInput): ScoreResult {
    // تطبيع documentsCount → 0-100
    const docsScore = Math.min(input.documentsCount * 33, 100)

    // الحساب الموزون
    const weighted =
      (input.ocrConfidence  * WEIGHTS.ocr)       +
      (input.nameMatchScore * WEIGHTS.nameMatch)  +
      (input.faceMatchScore * WEIGHTS.face)       +
      (docsScore            * WEIGHTS.documents)

    // خصم نقاط لعلامات الاحتيال
    const fraudPenalty = Math.min(input.fraudFlags * 30, 60)
    const rawScore     = Math.max(0, weighted - fraudPenalty)
    const finalScore   = Math.round(rawScore)

    // مستوى المخاطرة
    let riskLevel:    ScoreResult['riskLevel']
    let adminPriority: number
    let recommendation: string

    if (finalScore >= 70) {
      riskLevel      = 'LOW'
      adminPriority  = 3
      recommendation = 'بيانات جيدة — مراجعة سريعة مطلوبة'
    } else if (finalScore >= 45) {
      riskLevel      = 'MEDIUM'
      adminPriority  = 2
      recommendation = 'يحتاج تدقيق — راجع بيانات الرخصة والوجه'
    } else {
      riskLevel      = 'HIGH'
      adminPriority  = 1
      recommendation = 'مشبوه — مراجعة دقيقة ومقارنة يدوية مطلوبة'
    }

    return {
      finalScore,
      riskLevel,
      adminPriority,
      breakdown: {
        ocrScore:      Math.round(input.ocrConfidence  * WEIGHTS.ocr),
        nameScore:     Math.round(input.nameMatchScore * WEIGHTS.nameMatch),
        faceScore:     Math.round(input.faceMatchScore * WEIGHTS.face),
        docsScore:     Math.round(docsScore            * WEIGHTS.documents),
        fraudPenalty:  -fraudPenalty,
        total:         finalScore,
      },
      recommendation,
    }
  }
}
