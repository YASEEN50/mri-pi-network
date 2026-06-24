'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { performLogout } from '@/lib/auth-logout'

export default function PrivacyDataCard({ hasPassword }: { hasPassword: boolean }) {
  const { data: session } = useSession()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const [showDelete, setShowDelete] = useState(false)
  const [confirmPhrase, setConfirmPhrase] = useState('')
  const [password, setPassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const isOwnerOrAdmin = session?.user?.role === 'OWNER' || session?.user?.role === 'ADMIN'

  async function handleExport() {
    setExporting(true)
    setExportError('')
    try {
      const res = await fetch('/api/account/export', { cache: 'no-store' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setExportError(json.error?.message ?? 'فشل التصدير')
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? 'mri-data-export.json'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setExportError('حدث خطأ في الاتصال')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    if (confirmPhrase !== 'DELETE') {
      setDeleteError('اكتب DELETE للتأكيد')
      return
    }
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmPhrase,
          ...(hasPassword && password ? { password } : {}),
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setDeleteError(data.error?.message ?? 'فشل الحذف')
        return
      }
      performLogout(data.data?.redirectTo ?? '/')
    } catch {
      setDeleteError('حدث خطأ في الاتصال')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="text-white font-semibold mb-1">الخصوصية والبيانات 🔒</h3>
        <p className="text-slate-400 text-xs">
          تصدير نسخة من بياناتك (GDPR) أو حذف حسابك نهائياً.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-sm text-slate-300">تصدير البيانات</p>
        <p className="text-xs text-slate-500">
          ملف JSON يتضمن الملف الشخصي، المواعيد، الإشعارات، المعاملات، والسجلات الطبية (بيانات وصفية).
        </p>
        {exportError && (
          <p className="text-xs text-red-400">{exportError}</p>
        )}
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className="px-4 py-2 rounded-xl bg-primary/20 border border-primary/30 text-accent text-sm font-medium hover:bg-primary/30 disabled:opacity-50 transition-all"
        >
          {exporting ? 'جاري التصدير...' : '⬇️ تنزيل بياناتي'}
        </button>
      </div>

      {!isOwnerOrAdmin && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
          <p className="text-sm text-red-300 font-medium">حذف الحساب</p>
          <p className="text-xs text-slate-500">
            إجراء لا رجعة فيه. تُخفى بياناتك الشخصية وتُحذف الجلسات والإشعارات.
            نزّل نسخة احتياطية قبل المتابعة.
          </p>

          {!showDelete ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="text-xs text-red-400 hover:text-red-300 underline"
            >
              أريد حذف حسابي
            </button>
          ) : (
            <div className="space-y-3">
              {deleteError && (
                <p className="text-xs text-red-400">{deleteError}</p>
              )}
              {hasPassword && (
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="كلمة المرور"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500/50"
                />
              )}
              <input
                type="text"
                value={confirmPhrase}
                onChange={e => setConfirmPhrase(e.target.value)}
                placeholder='اكتب DELETE للتأكيد'
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500/50"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting || confirmPhrase !== 'DELETE' || (hasPassword && !password)}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium transition-all"
                >
                  {deleting ? 'جاري الحذف...' : 'حذف نهائي'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDelete(false)
                    setConfirmPhrase('')
                    setPassword('')
                    setDeleteError('')
                  }}
                  className="px-4 py-2.5 rounded-xl text-slate-400 text-sm hover:text-white"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isOwnerOrAdmin && (
        <p className="text-xs text-amber-400/80">
          حسابات المالك والأدمن لا يمكن حذفها ذاتياً — تواصل مع الدعم.
        </p>
      )}
    </div>
  )
}
