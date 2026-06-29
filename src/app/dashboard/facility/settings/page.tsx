'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { CountryCitySelect } from '@/components/geo/CountryCitySelect'

interface FacilityProfile {
  id: string
  name: string
  type: string
  description: string | null
  logoUrl: string | null
  coverUrl: string | null
  phone: string | null
  email: string | null
  website: string | null
  address: string
  city: string
  country: string
  approvalStatus: string
  averageRating: number
  totalReviews: number
}

const TYPE_LABELS: Record<string, string> = {
  HOSPITAL: 'مستشفى',
  CLINIC: 'عيادة',
  MEDICAL_CENTER: 'مركز طبي',
  LABORATORY: 'مختبر',
  PHARMACY: 'صيدلية',
  SCIENTIFIC_INSTITUTE: 'معهد علمي',
  UNIVERSITY: 'جامعة',
  MEDICAL_COLLEGE: 'كلية طب',
}

export default function FacilitySettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const tf = useTranslations('dashboard.facility')

  const [profile, setProfile] = useState<FacilityProfile | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    country: 'SA',
    city: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const logoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session && session.user.role !== 'FACILITY') { router.push('/unauthorized'); return }
    void load()
  }, [session, status, router])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/facility/profile')
      const data = await res.json()
      const p = data.data as FacilityProfile | null
      if (!p) return
      setProfile(p)
      setForm({
        name: p.name ?? '',
        description: p.description ?? '',
        phone: p.phone ?? '',
        email: p.email ?? '',
        website: p.website?.replace(/^https?:\/\//, '') ?? '',
        address: p.address ?? '',
        country: p.country ?? 'SA',
        city: p.city ?? '',
      })
    } catch {
      setError(tf('settings_load_error'))
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/facility/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error?.message ?? tf('settings_save_error'))
        return
      }
      setProfile((prev) => (prev ? { ...prev, ...data.data } : prev))
      setMessage(tf('settings_saved'))
    } catch {
      setError(tf('settings_save_error'))
    } finally {
      setSaving(false)
    }
  }

  async function uploadMedia(kind: 'logo' | 'cover', file: File) {
    setUploading(kind)
    setError('')
    setMessage('')

    try {
      let toUpload = file
      try {
        const { compressImageForUpload } = await import('@/lib/client/image-compress')
        toUpload = await compressImageForUpload(file)
      } catch { /* original */ }

      const fd = new FormData()
      fd.append('kind', kind)
      fd.append('file', toUpload)

      const res = await fetch('/api/facility/profile/media', { method: 'POST', body: fd })
      const data = await res.json()

      if (!data.success || !data.data?.url) {
        setError(data.data?.message ?? data.message ?? tf('settings_upload_error'))
        return
      }

      const field = kind === 'logo' ? 'logoUrl' : 'coverUrl'
      setProfile((prev) => (prev ? { ...prev, [field]: data.data.url } : prev))
      setMessage(kind === 'logo' ? tf('settings_logo_uploaded') : tf('settings_cover_uploaded'))
    } catch {
      setError(tf('settings_upload_error'))
    } finally {
      setUploading(null)
    }
  }

  async function removeMedia(kind: 'logo' | 'cover') {
    setUploading(kind)
    await fetch(`/api/facility/profile/media?kind=${kind}`, { method: 'DELETE' })
    const field = kind === 'logo' ? 'logoUrl' : 'coverUrl'
    setProfile((prev) => (prev ? { ...prev, [field]: null } : prev))
    setUploading(null)
  }

  function handleFilePick(kind: 'logo' | 'cover', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(tf('settings_image_only'))
      return
    }
    void uploadMedia(kind, file)
  }

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <Link href="/dashboard/facility/overview" className="text-slate-400 hover:text-white text-sm">
            ← {tf('overview_title')}
          </Link>
          <h1 className="text-2xl font-bold text-white mt-2">{tf('settings_title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{tf('settings_subtitle')}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
          </div>
        ) : !profile ? (
          <p className="text-slate-400">{tf('settings_load_error')}</p>
        ) : (
          <>
            {message && <p className="mb-4 text-sm text-teal-400">{message}</p>}
            {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

            {/* Cover + Logo */}
            <div className="mb-8 rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
              <div className="relative h-36 sm:h-44 bg-gradient-to-br from-teal-900/40 to-slate-900">
                {profile.coverUrl && (
                  <Image src={profile.coverUrl} alt="" fill unoptimized className="object-cover" sizes="100vw" />
                )}
                <div className="absolute inset-0 bg-black/30" />
                <div className="absolute bottom-3 left-3 flex gap-2">
                  <button
                    type="button"
                    disabled={uploading === 'cover'}
                    onClick={() => coverInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-black/50 border border-white/20 text-white text-xs hover:bg-black/70 disabled:opacity-50"
                  >
                    {uploading === 'cover' ? '...' : tf('settings_change_cover')}
                  </button>
                  {profile.coverUrl && (
                    <button
                      type="button"
                      disabled={uploading === 'cover'}
                      onClick={() => void removeMedia('cover')}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs"
                    >
                      {tf('settings_remove')}
                    </button>
                  )}
                </div>
              </div>

              <div className="px-5 pb-5 -mt-10 relative">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="relative w-20 h-20 rounded-2xl border-4 border-slate-900 overflow-hidden bg-slate-800 flex-shrink-0">
                    {profile.logoUrl ? (
                      <Image src={profile.logoUrl} alt={profile.name} fill unoptimized className="object-cover" sizes="80px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">🏥</div>
                    )}
                  </div>
                  <div className="flex gap-2 pb-1">
                    <button
                      type="button"
                      disabled={uploading === 'logo'}
                      onClick={() => logoInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-white text-xs hover:bg-white/15 disabled:opacity-50"
                    >
                      {uploading === 'logo' ? '...' : tf('settings_change_logo')}
                    </button>
                    {profile.logoUrl && (
                      <button
                        type="button"
                        disabled={uploading === 'logo'}
                        onClick={() => void removeMedia('logo')}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
                      >
                        {tf('settings_remove')}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-white font-semibold mt-3">{profile.name}</p>
                <p className="text-slate-500 text-xs">{TYPE_LABELS[profile.type] ?? profile.type}</p>
              </div>
            </div>

            <input ref={logoInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => handleFilePick('logo', e)} />
            <input ref={coverInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => handleFilePick('cover', e)} />

            <form onSubmit={(e) => void saveProfile(e)} className="space-y-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
              <h2 className="text-white font-semibold text-sm">{tf('settings_info_section')}</h2>

              <div>
                <label className="block text-slate-400 text-xs mb-1">{tf('settings_name')}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs mb-1">{tf('settings_description')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm resize-none"
                  placeholder={tf('settings_description_placeholder')}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">{tf('settings_phone')}</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">{tf('settings_email')}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-xs mb-1">{tf('settings_website')}</label>
                <div className="flex">
                  <span className="px-3 py-2.5 bg-white/5 border border-white/10 border-l-0 rounded-l-xl text-slate-500 text-sm" dir="ltr">
                    https://
                  </span>
                  <input
                    value={form.website}
                    onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                    className="flex-1 bg-white/5 border border-white/10 rounded-r-xl px-3 py-2.5 text-white text-sm"
                    placeholder="example.com"
                    dir="ltr"
                  />
                </div>
              </div>

              <CountryCitySelect
                country={form.country}
                city={form.city}
                onCountryChange={country => setForm(f => ({ ...f, country, city: '' }))}
                onCityChange={city => setForm(f => ({ ...f, city }))}
                inputClassName="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                labelClassName="block text-slate-400 text-xs mb-1"
                required
              />

              <div>
                <label className="block text-slate-400 text-xs mb-1">{tf('settings_address')}</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? '...' : tf('settings_save_btn')}
              </button>
            </form>

            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <Link
                href={`/facilities/${profile.id}`}
                target="_blank"
                className="text-teal-400 hover:underline"
              >
                {tf('settings_view_public')} →
              </Link>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}
