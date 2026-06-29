'use client'
// src/app/owner/risk-config/page.tsx
// إدارة أوزان محرك المخاطر من لوحة المالك

import { useState, useEffect, useCallback } from 'react'
import { useSession }  from 'next-auth/react'
import { useRouter }   from 'next/navigation'
import Navbar          from '@/components/common/Navbar'
import Link            from 'next/link'

// ─── Labels ───────────────────────────────────────────────────────────────────

const RULE_META: Record<string, { label: string; category: string; color: string }> = {
  FACE_NO_MATCH:         { label: 'لا يوجد تطابق للوجه',       category: 'هوية',     color: '#ef4444' },
  FACE_LOW_MATCH:        { label: 'تطابق الوجه منخفض',         category: 'هوية',     color: '#f97316' },
  FACE_MEDIUM_MATCH:     { label: 'تطابق الوجه متوسط',         category: 'هوية',     color: '#f59e0b' },
  LICENSE_EXPIRED:       { label: 'رخصة منتهية',               category: 'رخصة',     color: '#ef4444' },
  LICENSE_EXPIRING_SOON: { label: 'رخصة تنتهي قريباً',         category: 'رخصة',     color: '#f59e0b' },
  OCR_LOW_CONFIDENCE:    { label: 'دقة OCR منخفضة',           category: 'رخصة',     color: '#f97316' },
  NAME_MISMATCH:         { label: 'عدم تطابق الاسم',           category: 'رخصة',     color: '#f97316' },
  DUPLICATE_DOCUMENT:    { label: 'مستند مكرر (SHA256)',       category: 'احتيال',   color: '#dc2626' },
  SIMILAR_IMAGE:         { label: 'صورة متشابهة (pHash)',      category: 'احتيال',   color: '#ef4444' },
  DOCUMENT_FORENSICS:    { label: 'تزوير/تعديل مستند',         category: 'احتيال',   color: '#b91c1c' },
  HIGH_RISK_IP:          { label: 'IP عالي المخاطرة',          category: 'شبكة',     color: '#f97316' },
  MEDIUM_RISK_IP:        { label: 'IP متوسط المخاطرة',         category: 'شبكة',     color: '#f59e0b' },
  HIGH_RISK_DEVICE:      { label: 'جهاز عالي المخاطرة',        category: 'شبكة',     color: '#f97316' },
  MEDIUM_RISK_DEVICE:    { label: 'جهاز متوسط المخاطرة',       category: 'شبكة',     color: '#f59e0b' },
  NO_CERTIFICATES:       { label: 'لا توجد شهادات',            category: 'اكتمال',   color: '#64748b' },
  MULTIPLE_CERTIFICATES: { label: 'شهادات متعددة (تخفيض)',     category: 'اكتمال',   color: '#10b981' },
}

const CATEGORY_ORDER = ['هوية', 'رخصة', 'احتيال', 'شبكة', 'اكتمال']

interface WeightRow {
  rule:        string
  current:     number
  default:     number
  label:       string
  category:    string
  color:       string
  isModified:  boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RiskConfigPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [weights,   setWeights]   = useState<WeightRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [msg,       setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [edited,    setEdited]    = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/owner/risk-config')
      const data = await res.json()
      const cfg  = data.data?.current

      if (!cfg?.weights) return

      const rows: WeightRow[] = Object.entries(cfg.weights as Record<string, number>)
        .map(([rule, current]) => ({
          rule,
          current,
          default: (data.data?.defaults?.weights?.[rule] ?? current) as number,
          label:    RULE_META[rule]?.label    ?? rule,
          category: RULE_META[rule]?.category ?? 'أخرى',
          color:    RULE_META[rule]?.color    ?? '#64748b',
          isModified: current !== (data.data?.defaults?.weights?.[rule] ?? current),
        }))
        .sort((a, b) =>
          CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
        )

      setWeights(rows)
      setEdited({})
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') {
      const role = (session?.user as { role?: string })?.role
      if (role !== 'OWNER') { router.push('/unauthorized'); return }
      void load()
    }
  }, [status, session?.user, router, load])

  async function saveOne(rule: string, weight: number) {
    setSaving(rule)
    setMsg(null)
    try {
      const res  = await fetch('/api/owner/risk-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule, weight }),
      })
      const data = await res.json()
      if (data.data?.error) {
        setMsg({ type: 'err', text: data.data.message })
      } else {
        setMsg({ type: 'ok', text: data.data?.message ?? 'تم الحفظ' })
        // تحديث الـ row محلياً
        setWeights(prev => prev.map(w =>
          w.rule === rule
            ? { ...w, current: weight, isModified: weight !== w.default }
            : w
        ))
        setEdited(prev => { const n = { ...prev }; delete n[rule]; return n })
      }
    } catch { setMsg({ type: 'err', text: 'خطأ في الاتصال' }) }
    finally { setSaving(null) }
  }

  async function resetAll() {
    if (!confirm('هل أنت متأكد من إعادة ضبط جميع الأوزان للقيم الافتراضية؟')) return
    setResetting(true)
    setMsg(null)
    try {
      await fetch('/api/owner/risk-config', { method: 'PUT' })
      setMsg({ type: 'ok', text: 'تم إعادة ضبط جميع الأوزان' })
      await load()
    } catch { setMsg({ type: 'err', text: 'فشل إعادة الضبط' }) }
    finally { setResetting(false) }
  }

  // تجميع حسب الفئة
  const byCategory = CATEGORY_ORDER.reduce<Record<string, WeightRow[]>>((acc, cat) => {
    acc[cat] = weights.filter(w => w.category === cat)
    return acc
  }, {})

  const modifiedCount = weights.filter(w => w.isModified || edited[w.rule] !== undefined).length

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080c14' }}>
      <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: '#080c14' }} dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/owner" className="text-slate-500 hover:text-white text-sm transition-colors">
                ← لوحة المالك
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              ⚡ محرك المخاطر — إدارة الأوزان
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              كل وزن يمثل مقدار الـ Risk Score المضاف عند تفعيل القاعدة (الأوزان السالبة تخفض الخطورة)
            </p>
          </div>
          <div className="flex items-center gap-3">
            {modifiedCount > 0 && (
              <span className="text-xs px-2 py-1 rounded-lg"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                {modifiedCount} قاعدة معدّلة
              </span>
            )}
            <button onClick={resetAll} disabled={resetting}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {resetting ? '...' : '↺ إعادة الضبط'}
            </button>
          </div>
        </div>

        {/* Feedback */}
        {msg && (
          <div className="mb-6 px-4 py-3 rounded-xl text-sm"
            style={{
              background: msg.type === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${msg.type === 'ok' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              color: msg.type === 'ok' ? '#34d399' : '#f87171',
            }}>
            {msg.text}
          </div>
        )}

        {/* Score Thresholds Info */}
        <div className="rounded-2xl p-5 mb-6"
          style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <p className="text-blue-400 font-semibold text-sm mb-3">📊 حدود تصنيف المخاطرة</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { range: '0 – 30',   level: 'LOW',    color: '#10b981', label: 'منخفضة' },
              { range: '31 – 70',  level: 'MEDIUM', color: '#f59e0b', label: 'متوسطة' },
              { range: '71 – 100', level: 'HIGH',   color: '#ef4444', label: 'عالية' },
            ].map(t => (
              <div key={t.level} className="rounded-xl p-3 text-center"
                style={{ background: `${t.color}12`, border: `1px solid ${t.color}25` }}>
                <span className="text-xs font-bold" style={{ color: t.color }}>{t.range}</span>
                <p className="text-slate-400 text-xs mt-0.5">{t.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Rules by Category */}
        {CATEGORY_ORDER.map(cat => {
          const rows = byCategory[cat] ?? []
          if (!rows.length) return null
          return (
            <div key={cat} className="mb-6">
              <h2 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                <span className="w-1 h-4 rounded" style={{ background: rows[0]?.color ?? '#64748b' }} />
                {cat}
              </h2>
              <div className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                {rows.map((row, idx) => {
                  const editedVal   = edited[row.rule]
                  const displayVal  = editedVal !== undefined ? editedVal : row.current
                  const isModified  = editedVal !== undefined
                    ? editedVal !== row.default
                    : row.isModified

                  return (
                    <div key={row.rule}
                      className="flex items-center gap-4 px-5 py-4 transition-all"
                      style={{
                        background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      }}>

                      {/* Rule info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{row.label}</span>
                          {isModified && (
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                              معدّل
                            </span>
                          )}
                          {row.current < 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                              تخفيض
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 text-xs font-mono mt-0.5">{row.rule}</p>
                      </div>

                      {/* Default value */}
                      <div className="text-center w-16">
                        <p className="text-slate-600 text-xs">الافتراضي</p>
                        <p className="text-slate-400 text-sm font-mono">{row.default}</p>
                      </div>

                      {/* Weight input */}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={displayVal}
                          min={-50}
                          max={100}
                          onChange={e => {
                            const v = Number(e.target.value)
                            setEdited(prev => ({ ...prev, [row.rule]: v }))
                          }}
                          className="w-20 text-center bg-white/5 border rounded-lg px-2 py-1.5 text-white text-sm font-mono focus:outline-none transition-all"
                          style={{
                            borderColor: isModified ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)',
                          }}
                        />
                        <button
                          onClick={() => saveOne(row.rule, editedVal !== undefined ? editedVal : row.current)}
                          disabled={saving === row.rule || editedVal === undefined}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
                          style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
                          {saving === row.rule ? '...' : 'حفظ'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Bottom note */}
        <div className="rounded-xl p-4 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-slate-500 text-xs">
            التغييرات تُطبَّق فوراً على جلسات التحقق الجديدة — الجلسات القديمة لا تتأثر
          </p>
          <p className="text-slate-600 text-xs mt-1">
            الإصدار الحالي للخوارزمية: <span className="font-mono text-slate-500">v2.0.0</span>
          </p>
        </div>

      </div>
    </div>
  )
}
