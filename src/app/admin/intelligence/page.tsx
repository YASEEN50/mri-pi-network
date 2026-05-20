'use client'
// src/app/admin/intelligence/page.tsx
// لوحة Intelligence — نظرة عامة على IP/Device reputation

import { useState, useEffect, useCallback } from 'react'
import { useSession }  from 'next-auth/react'
import { useRouter }   from 'next/navigation'
import Navbar          from '@/components/common/Navbar'
import Link            from 'next/link'

type View = 'overview' | 'ips' | 'devices'

const RISK_BADGE: Record<string, string> = {
  HIGH:   'bg-red-500/15 text-red-400 border-red-500/25',
  MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  LOW:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
}

export default function IntelligencePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [view,    setView]    = useState<View>('overview')
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [banning, setBanning] = useState<string | null>(null)
  const [banMsg,  setBanMsg]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/admin/intelligence?view=${view}`)
      const json = await res.json()
      setData(json.data)
    } catch {}
    finally { setLoading(false) }
  }, [view])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') {
      const role = (session?.user as any)?.role
      if (role !== 'ADMIN' && role !== 'OWNER') { router.push('/unauthorized'); return }
      void load()
    }
  }, [status, session, router, load])

  async function banIP(ip: string) {
    const reason = prompt(`سبب حظر ${ip}:`, 'نشاط مشبوه')
    if (!reason) return
    setBanning(ip)
    try {
      const res = await fetch('/api/admin/intelligence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ban_ip', ipAddress: ip, reason }),
      })
      const json = await res.json()
      setBanMsg(json.data?.message ?? 'تم')
      await load()
    } catch {}
    finally { setBanning(null); setTimeout(() => setBanMsg(''), 3000) }
  }

  const TABS: { key: View; label: string; icon: string }[] = [
    { key: 'overview', label: 'نظرة عامة', icon: '📊' },
    { key: 'ips',      label: 'عناوين IP',  icon: '🌐' },
    { key: 'devices',  label: 'الأجهزة',    icon: '📱' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#080c14' }} dir="rtl">
      <Navbar locale="ar" />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/admin" className="text-slate-500 hover:text-white text-sm">← الإدارة</Link>
            </div>
            <h1 className="text-2xl font-bold text-white">🔭 Fraud Intelligence</h1>
            <p className="text-slate-400 text-sm mt-1">مراقبة IP, الأجهزة, والسلوك المشبوه</p>
          </div>
          <Link href="/admin/fraud-events"
            className="px-4 py-2 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            🚨 الأحداث
          </Link>
        </div>

        {banMsg && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
            {banMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setView(t.key)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: view === t.key ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${view === t.key ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                color: view === t.key ? '#60a5fa' : '#64748b',
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (

          // ── Overview ──────────────────────────────────────────────────────
          view === 'overview' && data && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {/* IP Stats */}
                <div className="rounded-2xl p-5 col-span-1"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-slate-400 text-sm mb-3">🌐 عناوين IP</p>
                  {[
                    ['الكلي',     data.ips?.total,    '#94a3b8'],
                    ['محظورة',   data.ips?.banned,   '#f87171'],
                    ['عالية الخطر', data.ips?.highRisk, '#f97316'],
                  ].map(([label, val, color]: any) => (
                    <div key={label} className="flex justify-between items-center py-1">
                      <span className="text-slate-400 text-sm">{label}</span>
                      <span className="font-bold text-sm" style={{ color }}>{val ?? 0}</span>
                    </div>
                  ))}
                </div>

                {/* Device Stats */}
                <div className="rounded-2xl p-5 col-span-1"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-slate-400 text-sm mb-3">📱 الأجهزة</p>
                  {[
                    ['الكلي',     data.devices?.total,  '#94a3b8'],
                    ['مشتركة',   data.devices?.shared,  '#f59e0b'],
                  ].map(([label, val, color]: any) => (
                    <div key={label} className="flex justify-between items-center py-1">
                      <span className="text-slate-400 text-sm">{label}</span>
                      <span className="font-bold text-sm" style={{ color }}>{val ?? 0}</span>
                    </div>
                  ))}
                </div>

                {/* Events Stats */}
                <div className="rounded-2xl p-5 col-span-1"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-slate-400 text-sm mb-3">🚨 الأحداث</p>
                  {[
                    ['مفتوحة',   data.events?.open,     '#f59e0b'],
                    ['حرجة',    data.events?.critical,  '#ef4444'],
                  ].map(([label, val, color]: any) => (
                    <div key={label} className="flex justify-between items-center py-1">
                      <span className="text-slate-400 text-sm">{label}</span>
                      <span className="font-bold text-sm" style={{ color }}>{val ?? 0}</span>
                    </div>
                  ))}
                  <Link href="/admin/fraud-events"
                    className="block mt-3 text-xs text-blue-400 hover:text-blue-300 text-center transition-colors">
                    عرض الأحداث ←
                  </Link>
                </div>
              </div>

              {/* Quick actions */}
              <div className="rounded-2xl p-5"
                style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)' }}>
                <p className="text-blue-400 text-sm font-medium mb-3">📋 إجراءات سريعة</p>
                <div className="flex gap-3 flex-wrap">
                  <button onClick={() => setView('ips')}
                    className="px-4 py-2 rounded-xl text-sm transition-all"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    عرض IPs عالية الخطر
                  </button>
                  <button onClick={() => setView('devices')}
                    className="px-4 py-2 rounded-xl text-sm transition-all"
                    style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                    الأجهزة المشتركة
                  </button>
                  <Link href="/admin/fraud-events"
                    className="px-4 py-2 rounded-xl text-sm transition-all"
                    style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }}>
                    أحداث الاحتيال
                  </Link>
                </div>
              </div>
            </div>
          ) ||

          // ── IPs ───────────────────────────────────────────────────────────
          view === 'ips' && (
            <div className="space-y-2">
              {!data?.length ? (
                <div className="text-center py-20 text-slate-500">
                  <div className="text-4xl mb-3">🌐</div>
                  <p>لا توجد IPs عالية المخاطرة</p>
                </div>
              ) : (
                (data as any[]).map((ip: any) => (
                  <div key={ip.id} className="rounded-xl p-4"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${RISK_BADGE[ip.riskLevel]}`}>
                          {ip.riskLevel}
                        </span>
                        <code className="text-white text-sm font-mono">{ip.ipAddress}</code>
                        {ip.isBanned && (
                          <span className="text-xs px-2 py-0.5 rounded"
                            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                            محظور
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-400">{ip.requestCount} طلب</span>
                        <span className="text-red-400">{ip.failedAttempts} فشل</span>
                        {!ip.isBanned && (
                          <button onClick={() => banIP(ip.ipAddress)}
                            disabled={banning === ip.ipAddress}
                            className="px-3 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {banning === ip.ipAddress ? '...' : '🚫 حظر'}
                          </button>
                        )}
                      </div>
                    </div>
                    {ip.banReason && (
                      <p className="text-slate-500 text-xs mt-1 mr-16">سبب الحظر: {ip.banReason}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          ) ||

          // ── Devices ───────────────────────────────────────────────────────
          view === 'devices' && (
            <div className="space-y-2">
              {!data?.length ? (
                <div className="text-center py-20 text-slate-500">
                  <div className="text-4xl mb-3">📱</div>
                  <p>لا توجد أجهزة عالية المخاطرة</p>
                </div>
              ) : (
                (data as any[]).map((dev: any) => (
                  <div key={dev.id} className="rounded-xl p-4"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${RISK_BADGE[dev.riskLevel]}`}>
                          {dev.riskLevel}
                        </span>
                        <code className="text-slate-300 text-sm font-mono">{dev.deviceId}</code>
                        {dev.linkedUsersCount > 3 && (
                          <span className="text-xs px-2 py-0.5 rounded"
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                            مشترك
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span>👥 {dev.linkedUsersCount} مستخدم</span>
                        <span>📊 {dev.totalAttempts} محاولة</span>
                      </div>
                    </div>
                    <p className="text-slate-600 text-xs mt-1 font-mono">
                      آخر ظهور: {new Date(dev.lastSeenAt).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                ))
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
