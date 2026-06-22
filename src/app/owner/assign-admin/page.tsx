'use client'
// src/app/owner/assign-admin/page.tsx

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import OwnerSubpageLayout from '@/components/owner/OwnerSubpageLayout'

interface User { id: string; email: string | null; role: string; piUsername?: string | null; createdAt?: string }

type SearchType = 'email' | 'piUsername' | 'userId'

export default function AssignAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [searchType, setSearchType] = useState<SearchType>('email')
  const [searchValue, setSearchValue] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [admins, setAdmins] = useState<User[]>([])
  const [reason, setReason] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role !== 'OWNER') router.push('/unauthorized')
  }, [status, session, router])

  useEffect(() => { fetchAdmins() }, [])

  async function fetchAdmins() {
    const res = await fetch('/api/owner/assign-admin?type=admins')
    const data = await res.json()
    if (data.success) setAdmins(data.data ?? [])
  }

  async function handleSearch() {
    if (!searchValue.trim()) return
    setIsSearching(true)
    setSearchResults([])
    setSelectedUser(null)
    try {
      const params = new URLSearchParams({ [searchType]: searchValue })
      const res = await fetch(`/api/owner/assign-admin?${params}`)
      const data = await res.json()
      if (data.success) setSearchResults(data.data ?? [])
      if (data.success && data.data?.length === 0) {
        setMessage({ type: 'error', text: 'لم يتم العثور على مستخدم' })
      }
    } finally { setIsSearching(false) }
  }

  async function handleAssign() {
    if (!selectedUser) return
    setIsSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/owner/assign-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, reason }),
      })
      const data = await res.json()
      if (data.success && !data.data?.error) {
        setMessage({ type: 'success', text: data.data?.message || 'تم التعيين بنجاح ✅' })
        setSelectedUser(null); setSearchValue(''); setSearchResults([]); setReason('')
        fetchAdmins()
      } else {
        setMessage({ type: 'error', text: data.data?.message || 'حدث خطأ' })
      }
    } catch { setMessage({ type: 'error', text: 'حدث خطأ في الاتصال' }) }
    finally { setIsSaving(false) }
  }

  async function handleRemove(userId: string, email: string | null) {
    if (!confirm(`هل تريد إزالة صلاحيات ${email ?? userId}؟`)) return
    try {
      const res = await fetch('/api/owner/assign-admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: data.data?.message || 'تم الإزالة ✅' })
        fetchAdmins()
      } else {
        setMessage({ type: 'error', text: data.data?.message || 'حدث خطأ' })
      }
    } catch { setMessage({ type: 'error', text: 'حدث خطأ في الاتصال' }) }
  }

  const roleLabel = (role: string) => ({
    DOCTOR: '👨‍⚕️ طبيب', FACILITY: '🏥 منشأة', CLIENT: '👤 عميل', ADMIN: '🛡️ أدمن'
  }[role] ?? role)

  const searchTypes = [
    { key: 'email' as SearchType, label: '📧 بريد إلكتروني', placeholder: 'أدخل البريد الإلكتروني...' },
    { key: 'piUsername' as SearchType, label: '🟣 Pi Username', placeholder: 'أدخل Pi Username...' },
    { key: 'userId' as SearchType, label: '🆔 User ID', placeholder: 'أدخل معرف المستخدم...' },
  ]

  const currentSearchType = searchTypes.find(t => t.key === searchType)!

  return (
    <OwnerSubpageLayout title="تعيين المديرين 🛡️" subtitle="تعيين وإدارة مديري المنصة">

        {message && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Current Admins */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
          <h3 className="text-white font-semibold mb-4">المديرون الحاليون ({admins.length})</h3>
          {admins.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">لا يوجد مديرون حالياً</p>
          ) : (
            <div className="space-y-2">
              {admins.map(admin => (
                <div key={admin.id} className="flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {admin.email ?? admin.piUsername ?? admin.id.slice(0, 8)}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      🛡️ مدير
                      {admin.piUsername && <span className="mr-2 text-purple-400">🟣 {admin.piUsername}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`/owner/admins/${admin.id}`}
                      className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-xl text-xs transition-all">
                      ⚙️ إدارة
                    </a>
                    <button onClick={() => handleRemove(admin.id, admin.email)}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs transition-all">
                      إزالة
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
          <h3 className="text-white font-semibold mb-4">🔍 تعيين مدير جديد</h3>

          {/* Search Type Tabs */}
          <div className="flex gap-2 mb-4">
            {searchTypes.map(t => (
              <button key={t.key} onClick={() => { setSearchType(t.key); setSearchValue(''); setSearchResults([]) }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  searchType === t.key
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="flex gap-2">
            <input
              type={searchType === 'email' ? 'email' : 'text'}
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={currentSearchType.placeholder}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <button onClick={handleSearch} disabled={isSearching}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all">
              {isSearching ? '...' : 'بحث'}
            </button>
          </div>

          {/* Results */}
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {searchResults.map(user => (
                <button key={user.id} onClick={() => setSelectedUser(user)}
                  className={`w-full text-right px-4 py-3 rounded-xl border transition-all ${
                    selectedUser?.id === user.id
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}>
                  <p className="text-white text-sm font-medium">
                    {user.email ?? user.piUsername ?? user.id.slice(0, 16)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-slate-400 text-xs">{roleLabel(user.role)}</span>
                    {user.piUsername && <span className="text-purple-400 text-xs">🟣 {user.piUsername}</span>}
                    <span className="text-slate-600 text-xs">{user.id.slice(0, 8)}...</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Confirm */}
        {selectedUser && (
          <>
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-4">
              <h3 className="text-white font-semibold mb-3">سبب التعيين (اختياري)</h3>
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                placeholder="سبب التعيين..." rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none" />
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 mb-4">
              <p className="text-amber-400 text-sm">
                سيتم تعيين <strong>{selectedUser.email ?? selectedUser.piUsername ?? selectedUser.id.slice(0, 8)}</strong> مديراً للمنصة
              </p>
            </div>

            <button onClick={handleAssign} disabled={isSaving}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl font-medium transition-all">
              {isSaving ? 'جاري التعيين...' : '🛡️ تعيين كمدير'}
            </button>
          </>
        )}
    </OwnerSubpageLayout>
  )
}