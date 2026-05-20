'use client'
// src/app/admin/settings/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'

const CONFIG_LABELS: Record<string, { label: string; desc: string; type: 'number' | 'bool' }> = {
  ai_confidence_threshold: { label: 'حد ثقة AI (%)',         desc: 'الحد الأدنى لقبول الشهادة تلقائياً',       type: 'number' },
  face_match_threshold:    { label: 'حد تطابق الوجه (%)',    desc: 'الحد الأدنى لقبول تطابق الوجه',            type: 'number' },
  name_match_threshold:    { label: 'حد تطابق الاسم (%)',    desc: 'الحد الأدنى لمطابقة الاسم مع الشهادة',     type: 'number' },
  max_upload_attempts:     { label: 'أقصى محاولات رفع',      desc: 'عدد مرات رفع المستندات المسموحة',          type: 'number' },
  require_human_review:    { label: 'مراجعة بشرية إجبارية',  desc: 'هل يجب دائماً مراجعة بشرية بعد AI؟',       type: 'bool'   },
}

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router    = useRouter()
  const [config,  setConfig]  = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [message, setMessage] = useState('')

  const fetchConfig = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/config')
      const data = await res.json()
      setConfig(data.data ?? {})
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && session.user.role !== 'OWNER') { router.push('/unauthorized'); return }
    void fetchConfig()
  }, [session, status, router, fetchConfig])

  async function handleSave() {
    setSaving(true)
    setMessage('')
    try {
      const res  = await fetch('/api/admin/config', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(config),
      })
      const data = await res.json()
      setMessage(data.data?.error ? data.data.message : '✅ تم حفظ الإعدادات')
    } catch {
      setMessage('❌ حدث خطأ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/verification" className="text-slate-400 hover:text-white text-sm transition-colors">
            ← رجوع
          </Link>
          <h1 className="text-xl font-bold text-white">إعدادات نظام التحقق</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 space-y-5">
            {Object.entries(CONFIG_LABELS).map(([key, meta]) => (
              <div key={key}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <label className="text-white font-medium text-sm">{meta.label}</label>
                    <p className="text-slate-500 text-xs mt-0.5">{meta.desc}</p>
                  </div>
                  {meta.type === 'bool' ? (
                    <button
                      onClick={() => setConfig(c => ({ ...c, [key]: c[key] === 'true' ? 'false' : 'true' }))}
                      className={`w-12 h-6 rounded-full transition-all relative ${config[key] === 'true' ? 'bg-emerald-500' : 'bg-white/20'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${config[key] === 'true' ? 'left-6' : 'left-0.5'}`} />
                    </button>
                  ) : (
                    <input
                      type="number" min="0" max="100"
                      value={config[key] ?? ''}
                      onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
                      className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-emerald-500/50"
                    />
                  )}
                </div>
                <div className="h-px bg-white/5" />
              </div>
            ))}

            {message && (
              <div className={`px-4 py-3 rounded-xl text-sm ${message.startsWith('✅') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                {message}
              </div>
            )}

            <button onClick={handleSave} disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all">
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
