'use client'
// src/app/profile/page.tsx

import SettingsTab from '@/components/profile/SettingsTab'
import DoctorDocumentsSidebar from '@/components/profile/DoctorDocumentsSidebar'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Navbar from '@/components/common/Navbar'
import Link from 'next/link'
import Image from 'next/image'

// =====================================================================
// الحالات الصحية
// =====================================================================
const healthStatuses = [
  { key: 'GOOD',        label: 'بصحة جيدة',           icon: '💚', color: 'text-emerald-400',  bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { key: 'MONITORING',  label: 'تحت المتابعة الطبية',  icon: '🟡', color: 'text-amber-400',    bg: 'bg-amber-500/10 border-amber-500/20' },
  { key: 'SICK',        label: 'مريض',                 icon: '🔴', color: 'text-red-400',      bg: 'bg-red-500/10 border-red-500/20' },
  { key: 'RECOVERING',  label: 'في تعافٍ',             icon: '🔵', color: 'text-blue-400',     bg: 'bg-blue-500/10 border-blue-500/20' },
  { key: 'CHRONIC',     label: 'مرض مزمن',             icon: '🟠', color: 'text-orange-400',   bg: 'bg-orange-500/10 border-orange-500/20' },
  { key: 'PREGNANT',    label: 'حامل',                 icon: '🤱', color: 'text-pink-400',     bg: 'bg-pink-500/10 border-pink-500/20' },
  { key: 'ELDERLY',     label: 'رعاية مسنين',          icon: '👴', color: 'text-purple-400',   bg: 'bg-purple-500/10 border-purple-500/20' },
  { key: 'UNSPECIFIED', label: 'غير محدد',             icon: '⚪', color: 'text-slate-400',    bg: 'bg-slate-500/10 border-slate-500/20' },
]

interface ProfileData {
  firstName?: string
  lastName?: string
  avatarUrl?: string
  bio?: string
  city?: string
  phone?: string
  gender?: string
  dateOfBirth?: string
  bloodType?: string
  allergies?: string[]
  chronicDiseases?: string[]
  healthStatus?: string
  specialization?: string
  yearsOfExperience?: number
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [profile, setProfile] = useState<ProfileData>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'health' | 'settings'>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab')
      if (p === 'health' || p === 'settings') return p
    }
    return 'info'
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (session) fetchProfile()
  }, [session])

  async function fetchProfile() {
    try {
      const res = await fetch('/api/profile')
      const data = await res.json()
      if (session?.user?.role === 'DOCTOR' && data.success && data.data === null) {
        router.replace('/onboarding/doctor')
        return
      }
      if (data.success && data.data) setProfile(data.data)
    } finally { setIsLoading(false) }
  }

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const isImage =
      file.type.startsWith('image/') ||
      file.type === '' ||
      /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
    if (!isImage) {
      setMessage({ type: 'error', text: 'يُقبل فقط ملفات الصور (JPEG أو PNG)' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'حجم الصورة يتجاوز 10MB' })
      return
    }

    setAvatarUploading(true)
    setMessage(null)

    const localPreview = URL.createObjectURL(file)
    setAvatarPreview(localPreview)

    try {
      let toUpload = file
      try {
        const { compressImageForUpload } = await import('@/lib/client/image-compress')
        toUpload = await compressImageForUpload(file)
      } catch { /* original */ }

      const fd = new FormData()
      fd.append('file', toUpload)

      const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd })
      const data = await res.json()

      if (!data.success || !data.data?.avatarUrl) {
        setAvatarPreview(null)
        setMessage({
          type: 'error',
          text:
            data.message ??
            data.error?.message ??
            data.data?.message ??
            (res.ok ? 'فشل رفع الصورة' : `فشل رفع الصورة (${res.status})`),
        })
        return
      }

      setProfile(p => ({ ...p, avatarUrl: data.data.avatarUrl }))
      setMessage({ type: 'success', text: 'تم تحديث الصورة الشخصية ✅' })
    } catch {
      setAvatarPreview(null)
      setMessage({ type: 'error', text: 'حدث خطأ أثناء رفع الصورة' })
    } finally {
      setAvatarUploading(false)
      URL.revokeObjectURL(localPreview)
      setAvatarPreview(null)
    }
  }

  async function handleSave() {
    setIsSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'تم حفظ الملف الشخصي بنجاح ✅' })
        setIsEditing(false)
      } else {
        setMessage({
          type: 'error',
          text: data.error?.message ?? data.message ?? data.data?.message ?? 'حدث خطأ',
        })
      }
    } catch { setMessage({ type: 'error', text: 'حدث خطأ في الاتصال' }) }
    finally { setIsSaving(false) }
  }

  if (!session || isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  const role = session.user.role
  const isClient = role === 'CLIENT'
  const isDoctor = role === 'DOCTOR'

  const roleLabel: Record<string, string> = {
    CLIENT: 'عميل', DOCTOR: 'طبيب', FACILITY: 'منشأة',
    ADMIN: 'مشرف', OWNER: 'مالك المنصة'
  }

  const currentHealthStatus = healthStatuses.find(h => h.key === (profile.healthStatus ?? 'UNSPECIFIED'))
    ?? healthStatuses[7]

  const displayName = profile.firstName
    ? `${profile.firstName} ${profile.lastName ?? ''}`
    : session.user.email ?? `@${session.user.piUsername}`

  const avatarLetter = (profile.firstName?.[0] ?? session.user.email?.[0] ?? 'U').toUpperCase()
  const displayAvatar = avatarPreview ?? profile.avatarUrl
  const canUploadAvatar = isClient || isDoctor

  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <Navbar locale="ar" />
      <div className={`mx-auto px-4 sm:px-6 py-12 ${isDoctor ? 'max-w-6xl' : 'max-w-2xl'}`}>

        {/* Header Card */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-5">

            {/* Avatar */}
            <div className="relative">
              <button
                type="button"
                disabled={!isEditing || !canUploadAvatar || avatarUploading}
                onClick={() => isEditing && canUploadAvatar && avatarInputRef.current?.click()}
                className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/25 flex items-center justify-center text-3xl font-bold text-accent overflow-hidden relative ${
                  isEditing && canUploadAvatar ? 'cursor-pointer hover:ring-2 hover:ring-accent/40 transition-all' : 'cursor-default'
                }`}
              >
                {displayAvatar
                  ? <Image src={displayAvatar} alt="avatar" width={80} height={80} unoptimized className="w-full h-full object-cover" />
                  : avatarLetter
                }
                {avatarUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
                  </div>
                )}
              </button>
              {isEditing && canUploadAvatar && (
                <>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarPick}
                  />
                  <button
                    type="button"
                    disabled={avatarUploading}
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary border-2 border-slate-950 flex items-center justify-center text-xs hover:bg-primary-400 transition-colors disabled:opacity-50"
                    title="تغيير الصورة"
                  >
                    📷
                  </button>
                </>
              )}
              {isClient && (
                <div className={`absolute -bottom-1 -left-1 w-6 h-6 rounded-full border-2 border-slate-950 flex items-center justify-center text-xs ${currentHealthStatus.bg} border`}>
                  {currentHealthStatus.icon}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{displayName}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="px-2.5 py-0.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  {roleLabel[role] ?? role}
                </span>
                {isClient && (
                  <span className={`px-2.5 py-0.5 text-xs border rounded-full ${currentHealthStatus.bg} ${currentHealthStatus.color}`}>
                    {currentHealthStatus.icon} {currentHealthStatus.label}
                  </span>
                )}
                {isDoctor && profile.specialization && (
                  <span className="px-2.5 py-0.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
                    {profile.specialization}
                  </span>
                )}
              </div>
              {session.user.piUsername && (
                <p className="text-purple-400 text-xs mt-1">🟣 @{session.user.piUsername}</p>
              )}
            </div>

            {/* Edit Button */}
            <button onClick={() => setIsEditing(!isEditing)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                isEditing
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                  : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
              }`}>
              {isEditing ? 'إلغاء' : '✏️ تعديل'}
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <div className={`${isDoctor ? 'flex flex-col lg:flex-row gap-6 items-start' : ''}`}>

        {isDoctor && (
          <DoctorDocumentsSidebar approvalStatus={session.user.approvalStatus ?? undefined} />
        )}

        <div className={isDoctor ? 'flex-1 min-w-0 w-full' : 'w-full'}>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'info' as const, label: 'المعلومات', icon: '👤' },
            ...(isClient ? [{ key: 'health' as const, label: 'الصحة', icon: '🏥' }] : []),
            { key: 'settings' as const, label: 'الإعدادات', icon: '⚙️' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: المعلومات */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">المعلومات الأساسية</h3>
              <div className="space-y-3">

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">الاسم الأول</label>
                    {isEditing
                      ? <input value={profile.firstName ?? ''} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                      : <p className="text-white text-sm">{profile.firstName ?? '-'}</p>
                    }
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">الاسم الأخير</label>
                    {isEditing
                      ? <input value={profile.lastName ?? ''} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                      : <p className="text-white text-sm">{profile.lastName ?? '-'}</p>
                    }
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 text-xs mb-1 block">رقم الجوال</label>
                  {isEditing
                    ? <input value={profile.phone ?? ''} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+966xxxxxxxxx"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                    : <p className="text-white text-sm">{profile.phone ?? '-'}</p>
                  }
                </div>

                <div>
                  <label className="text-slate-400 text-xs mb-1 block">المدينة</label>
                  {isEditing
                    ? <input value={profile.city ?? ''} onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                    : <p className="text-white text-sm">{profile.city ?? '-'}</p>
                  }
                </div>

                {isEditing && (
                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">الجنس</label>
                    <select value={profile.gender ?? ''} onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50">
                      <option value="">اختر...</option>
                      <option value="MALE">ذكر</option>
                      <option value="FEMALE">أنثى</option>
                    </select>
                  </div>
                )}

                {isDoctor && (
                  <>
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">نبذة شخصية</label>
                      {isEditing
                        ? <textarea value={profile.bio ?? ''} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                            rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none" />
                        : <p className="text-white text-sm">{profile.bio ?? '-'}</p>
                      }
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">سنوات الخبرة</label>
                      {isEditing
                        ? <input type="number" value={profile.yearsOfExperience ?? 0} onChange={e => setProfile(p => ({ ...p, yearsOfExperience: parseInt(e.target.value) }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                        : <p className="text-white text-sm">{profile.yearsOfExperience ?? 0} سنة</p>
                      }
                    </div>
                  </>
                )}

              </div>
            </div>

            {isEditing && canUploadAvatar && (
              <div className="mpi-card rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-2">الصورة الشخصية</h3>
                <p className="text-slate-400 text-sm mb-3">
                  اضغط على الصورة أعلاه أو الزر 📷 لاختيار صورة من معرض الهاتف أو الجهاز.
                </p>
                <button
                  type="button"
                  disabled={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border border-dashed border-white/20 text-slate-300 hover:border-accent/40 hover:text-accent transition-all text-sm disabled:opacity-50"
                >
                  {avatarUploading ? 'جاري رفع الصورة...' : '📁 اختيار صورة من المعرض'}
                </button>
                <p className="text-slate-500 text-xs mt-2">PNG أو JPG — حد أقصى 10MB</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: الصحة (للعملاء فقط) */}
        {activeTab === 'health' && isClient && (
          <div className="space-y-4">

            {/* الحالة الصحية */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">الحالة الصحية</h3>
              <div className="grid grid-cols-2 gap-2">
                {healthStatuses.map(hs => (
                  <button key={hs.key}
                    onClick={() => isEditing && setProfile(p => ({ ...p, healthStatus: hs.key }))}
                    disabled={!isEditing}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                      profile.healthStatus === hs.key || (!profile.healthStatus && hs.key === 'UNSPECIFIED')
                        ? `${hs.bg} ${hs.color} font-medium`
                        : 'bg-white/[0.02] border-white/[0.06] text-slate-400'
                    } ${isEditing ? 'hover:border-white/20 cursor-pointer' : 'cursor-default'}`}>
                    <span>{hs.icon}</span>
                    <span className="text-xs">{hs.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* المعلومات الطبية */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">المعلومات الطبية</h3>
              <div className="space-y-3">

                <div>
                  <label className="text-slate-400 text-xs mb-1 block">فصيلة الدم</label>
                  {isEditing
                    ? <select value={profile.bloodType ?? ''} onChange={e => setProfile(p => ({ ...p, bloodType: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50">
                        <option value="">اختر...</option>
                        {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bt => (
                          <option key={bt} value={bt}>{bt}</option>
                        ))}
                      </select>
                    : <p className="text-white text-sm">{profile.bloodType ?? '-'}</p>
                  }
                </div>

                <div>
                  <label className="text-slate-400 text-xs mb-1 block">الحساسية (افصل بفاصلة)</label>
                  {isEditing
                    ? <input value={profile.allergies?.join(', ') ?? ''} onChange={e => setProfile(p => ({ ...p, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                        placeholder="مثال: البنسلين، الفول السوداني"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                    : <p className="text-white text-sm">{profile.allergies?.join('، ') ?? '-'}</p>
                  }
                </div>

                <div>
                  <label className="text-slate-400 text-xs mb-1 block">الأمراض المزمنة (افصل بفاصلة)</label>
                  {isEditing
                    ? <input value={profile.chronicDiseases?.join(', ') ?? ''} onChange={e => setProfile(p => ({ ...p, chronicDiseases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                        placeholder="مثال: السكري، ضغط الدم"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                    : <p className="text-white text-sm">{profile.chronicDiseases?.join('، ') ?? '-'}</p>
                  }
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Tab: الإعدادات */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">معلومات الحساب</h3>
              <div className="space-y-3 text-sm">
                {session.user.email && (
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">البريد الإلكتروني</span>
                    <span className="text-white">{session.user.email}</span>
                  </div>
                )}
                {session.user.piUsername && (
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">حساب Pi</span>
                    <span className="text-purple-400">@{session.user.piUsername}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400">الدور</span>
                  <span className="text-emerald-400">{roleLabel[role] ?? role}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">معرف الحساب</span>
                  <span className="text-white font-mono text-xs">{session.user.id.slice(0, 16)}...</span>
                </div>
              </div>
            </div>

           <SettingsTab
             userEmail={session.user.email}
             piUsername={session.user.piUsername}
             piUid={session.user.piUid}
           />
            {/* روابط سريعة */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">روابط سريعة</h3>
              <div className="space-y-2">
                {[
                  { label: 'لوحة التحكم', href: role === 'DOCTOR' ? '/dashboard/doctor/schedule' : role === 'ADMIN' || role === 'OWNER' ? '/admin' : '/dashboard/client/appointments', icon: '🏠' },
                  { label: 'مواعيدي', href: '/dashboard/client/appointments', icon: '📅' },
                  { label: 'الأطباء', href: '/doctors', icon: '👨‍⚕️' },
                  ...(role === 'DOCTOR' ? [
                    { label: 'إعدادات الدفع', href: '/dashboard/doctor/payment-settings', icon: '💳' },
                    { label: 'البريميو', href: '/dashboard/doctor/premio', icon: '💎' },
                  ] : []),
                  ...(role === 'OWNER' ? [{ label: 'لوحة المالك', href: '/owner', icon: '👑' }] : []),
                ].map(link => (
                  <Link key={link.href} href={link.href}
                    className="flex items-center gap-3 p-3 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 rounded-xl transition-all">
                    <span>{link.icon}</span>
                    <span className="text-sm text-slate-300">{link.label}</span>
                    <span className="mr-auto text-slate-600 text-xs">←</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        {isEditing && (
          <button onClick={handleSave} disabled={isSaving}
            className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all">
            {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        )}

        </div>
        </div>

      </div>
    </div>
  )
}