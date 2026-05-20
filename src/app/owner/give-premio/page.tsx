'use client'
import Navbar from '@/components/common/Navbar'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface User { id: string; email: string; role: string; premios: any[] }

const premioTypes = [
  { key: 'MONTHLY', label: 'شهري', icon: '📅' },
  { key: 'YEARLY', label: 'سنوي', icon: '📆' },
  { key: 'LIFETIME', label: 'مدى الحياة', icon: '♾️' },
]

export default function GivePremioPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedType, setSelectedType] = useState('MONTHLY')
  const [notes, setNotes] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role !== 'OWNER') router.push('/unauthorized')
  }, [status, session, router])

  async function handleSearch() {
    if (!searchEmail.trim()) return
    setIsSearching(true)
    setSearchResults([])
    setSelectedUser(null)
    try {
      const res = await fetch(`/api/owner/give-premio?email=${encodeURIComponent(searchEmail)}`)
      const data = await res.json()
      if (data.success) setSearchResults(data.data ?? [])
    } finally { setIsSearching(false) }
  }

  async function handleGive() {
    if (!selectedUser) return
    setIsSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/owner/give-premio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, type: selectedType, notes: notes || undefined }),
      })
      const data = await res.json()
      if (data.success && !data.data?.error) {
        setMessage({ type: 'success', text: `✅ تم منح البريميو لـ ${selectedUser.email}` })
        setSelectedUser(null); setSearchEmail(''); setSearchResults([]); setNotes('')
      } else {
        setMessage({ type: 'error', text: data.data?.message || 'حدث خطأ' })
      }
    } catch { setMessage({ type: 'error', text: 'حدث خطأ في الاتصال' }) }
    finally { setIsSaving(false) }
  }

  const roleLabel = (role: string) => ({ DOCTOR: '👨‍⚕️ طبيب', FACILITY: '🏥 منشأة', CLIENT: '👤 عميل' }[role] ?? role)

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/owner" className="text-slate-400 hover:text-white text-sm">← لوحة المالك</Link>
          <div>
            <h1 className="text-2xl font-bold text-white">منح بريميو مجاني 🎁</h1>
            <p className="text-slate-400 text-sm mt-1">امنح بريميو لأي مستخدم</p>
          </div>
        </div>

        {message && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
          <h3 className="text-white font-semibold mb-4">🔍 ابحث عن مستخدم</h3>
          <div className="flex gap-2">
            <input type="email" value={searchEmail}
              onChange={e => setSearchEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="أدخل البريد الإلكتروني..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
            <button onClick={handleSearch} disabled={isSearching}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all">
              {isSearching ? '...' : 'بحث'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {searchResults.map(user => (
                <button key={user.id} onClick={() => setSelectedUser(user)}
                  className={`w-full text-right px-4 py-3 rounded-xl border transition-all ${selectedUser?.id === user.id ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                  <p className="text-white text-sm font-medium">{user.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-slate-400 text-xs">{roleLabel(user.role)}</span>
                    {user.premios?.length > 0 && <span className="text-amber-400 text-xs">💎 لديه بريميو نشط</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedUser && (
          <>
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
              <h3 className="text-white font-semibold mb-4">نوع البريميو</h3>
              <div className="grid grid-cols-3 gap-3">
                {premioTypes.map(t => (
                  <button key={t.key} onClick={() => setSelectedType(t.key)}
                    className={`py-3 rounded-xl border text-center transition-all ${selectedType === t.key ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}>
                    <div className="text-2xl mb-1">{t.icon}</div>
                    <div className="text-xs font-medium">{t.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
              <h3 className="text-white font-semibold mb-3">ملاحظة (اختياري)</h3>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="سبب المنح..." rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none" />
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 mb-4">
              <p className="text-amber-400 text-sm">
                سيتم منح بريميو <strong>{premioTypes.find(t => t.key === selectedType)?.label}</strong> مجاناً لـ <strong>{selectedUser.email}</strong>
              </p>
            </div>
            <button onClick={handleGive} disabled={isSaving}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl font-medium transition-all">
              {isSaving ? 'جاري المنح...' : '🎁 منح البريميو'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
