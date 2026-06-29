/** HTML verification review report for admin print/PDF export */

export interface ReviewReportData {
  generatedAt: string
  sessionId: string
  currentState: string
  doctor: {
    name: string
    specialization: string | null
    licenseNumber: string | null
    city: string | null
    email: string | null
  }
  score: {
    finalScore: number | null
    riskLevel: string | null
    ocrConfidence: number | null
    faceMatchScore: number | null
    fraudRiskScore: number | null
    flags: string[]
    explanation: string | null
    recommendation: string | null
  } | null
  faceVerification: {
    matchScore: number
    confidence: number
    facesDetected: boolean
  } | null
  documents: Array<{
    docType: string
    docTypeLabel: string
    legalName: string | null
    forensicsScore: number | null
    isFlagged: boolean
    flagReason: string | null
    signals: string[]
  }>
  fraudFlags: Array<{ type: string; similarity: number | null; flags: string[] }>
  internalNotes: Array<{ authorName: string; body: string; createdAt: string }>
  assignment: { name: string; email: string | null } | null
}

const DOC_LABELS: Record<string, string> = {
  CREDENTIAL:  'شهادة جامعية',
  LICENSE:     'رخصة مزاولة',
  DATAFLOW:    'Dataflow',
  ID_DOCUMENT: 'هوية',
  SELFIE:      'سيلفي',
}

export function docTypeLabel(docType: string): string {
  return DOC_LABELS[docType] ?? docType
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderVerificationReportHtml(data: ReviewReportData): string {
  const riskColor =
    data.score?.riskLevel === 'HIGH' ? '#dc2626'
      : data.score?.riskLevel === 'MEDIUM' ? '#d97706'
        : '#059669'

  const docsRows = data.documents.map((d) => `
    <tr>
      <td>${esc(d.docTypeLabel)}</td>
      <td>${esc(d.legalName ?? '—')}</td>
      <td>${d.forensicsScore ?? '—'}</td>
      <td>${d.isFlagged ? '⚠️ نعم' : 'لا'}</td>
      <td style="font-size:11px">${esc(d.signals.join(' · ') || d.flagReason || '—')}</td>
    </tr>
  `).join('')

  const fraudRows = data.fraudFlags.length === 0
    ? '<tr><td colspan="3" style="text-align:center;color:#64748b">لا توجد</td></tr>'
    : data.fraudFlags.map((f) => `
      <tr>
        <td>${esc(f.type)}</td>
        <td>${f.similarity ?? '—'}%</td>
        <td>${esc(f.flags.join(' · '))}</td>
      </tr>
    `).join('')

  const notesBlock = data.internalNotes.length === 0
    ? '<p style="color:#64748b;font-size:13px">لا توجد ملاحظات داخلية</p>'
    : data.internalNotes.map((n) => `
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:8px">
        <div style="font-size:11px;color:#64748b;margin-bottom:4px">${esc(n.authorName)} · ${esc(n.createdAt)}</div>
        <div style="font-size:13px">${esc(n.body)}</div>
      </div>
    `).join('')

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <title>تقرير مراجعة تحقق — ${esc(data.doctor.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 15px; margin: 24px 0 10px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
    .label { font-size: 11px; color: #64748b; }
    .value { font-size: 14px; font-weight: 600; margin-top: 2px; }
    .risk-badge { display: inline-block; padding: 6px 14px; border-radius: 8px; color: #fff; font-weight: 700; background: ${riskColor}; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: right; }
    th { background: #f8fafc; font-weight: 600; }
    .disclaimer { margin-top: 28px; padding: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 11px; color: #92400e; }
    @media print {
      body { padding: 12px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:16px">
    <button onclick="window.print()" style="padding:10px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">
      🖨️ طباعة / حفظ PDF
    </button>
  </div>

  <h1>تقرير مراجعة تحقق طبيب</h1>
  <div class="meta">
    تاريخ التقرير: ${esc(data.generatedAt)} ·
    معرّف الجلسة: ${esc(data.sessionId.slice(0, 8))}… ·
    الحالة: ${esc(data.currentState)}
  </div>

  <h2>👨‍⚕️ بيانات الطبيب</h2>
  <div class="grid">
    <div class="card"><div class="label">الاسم</div><div class="value">${esc(data.doctor.name)}</div></div>
    <div class="card"><div class="label">التخصص</div><div class="value">${esc(data.doctor.specialization ?? '—')}</div></div>
    <div class="card"><div class="label">رقم الرخصة</div><div class="value">${esc(data.doctor.licenseNumber ?? '—')}</div></div>
    <div class="card"><div class="label">المدينة / البريد</div><div class="value">${esc(data.doctor.city ?? '—')} · ${esc(data.doctor.email ?? '—')}</div></div>
  </div>

  <h2>📊 تقييم المخاطرة</h2>
  <div class="grid">
    <div class="card">
      <div class="label">درجة المخاطرة</div>
      <div style="margin-top:8px">
        <span class="risk-badge">${data.score?.finalScore ?? '—'} · ${esc(data.score?.riskLevel ?? '—')}</span>
      </div>
    </div>
    <div class="card">
      <div class="label">OCR / الوجه / الاحتيال</div>
      <div class="value">${data.score?.ocrConfidence ?? '—'}% / ${data.score?.faceMatchScore ?? '—'}% / ${data.score?.fraudRiskScore ?? '—'}%</div>
    </div>
  </div>
  ${data.score?.explanation ? `<p style="font-size:13px;margin-top:10px">${esc(data.score.explanation)}</p>` : ''}
  ${data.score?.recommendation ? `<p style="font-size:12px;color:#475569">${esc(data.score.recommendation)}</p>` : ''}
  ${data.score?.flags?.length ? `<p style="font-size:12px"><strong>العلامات:</strong> ${esc(data.score.flags.join(' · '))}</p>` : ''}

  ${data.faceVerification ? `
  <h2>🪪 مقارنة الوجه</h2>
  <p style="font-size:13px">تطابق ${data.faceVerification.matchScore}% · ثقة ${data.faceVerification.confidence} · ${data.faceVerification.facesDetected ? 'تم اكتشاف الوجه' : 'لم يُكتشف'}</p>
  ` : ''}

  <h2>📁 المستندات</h2>
  <table>
    <thead><tr><th>النوع</th><th>الاسم في المستند</th><th>Forensics</th><th>مُعلّم</th><th>إشارات</th></tr></thead>
    <tbody>${docsRows}</tbody>
  </table>

  <h2>⚠️ علامات الاحتيال</h2>
  <table>
    <thead><tr><th>النوع</th><th>التشابه</th><th>التفاصيل</th></tr></thead>
    <tbody>${fraudRows}</tbody>
  </table>

  <h2>💬 ملاحظات داخلية (إدارية)</h2>
  ${notesBlock}

  ${data.assignment ? `<p style="font-size:12px;color:#64748b;margin-top:16px">المراجع المُسنَد: ${esc(data.assignment.name)}</p>` : ''}

  <div class="disclaimer">
    هذا التقرير للمراجعة الإدارية الداخلية فقط. إشارات forensics ليست حكماً قانونياً نهائياً — القرار النهائي للمراجع البشري.
  </div>
</body>
</html>`
}
