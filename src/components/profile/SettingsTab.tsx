'use client'
// src/components/profile/SettingsTab.tsx

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import AccountLinkingCard from '@/components/profile/AccountLinkingCard'

export default function SettingsTab({
  userEmail,
  piUsername,
  piUid,
}: {
  userEmail?: string | null
  piUsername?: string | null
  piUid?: string | null
}) {
  const { update } = useSession()
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [isSendingEmail, setIsSendingEmail] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [changeNewPassword, setChangeNewPassword] = useState('')
  const [confirmChangePassword, setConfirmChangePassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  async function handleChangeEmail() {
    if (!newEmail) return
    setIsSendingEmail(true)
    setEmailError('')
    try {
      const res = await fetch('/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail }),
      })
      const data = await res.json()
      if (data.success && !data.data?.error) {
        setEmailSent(true)
        setNewEmail('')
      } else {
        setEmailError(data.data?.message || 'حدث خطأ')
      }
    } catch { setEmailError('حدث خطأ في الاتصال') }
    finally { setIsSendingEmail(false) }
  }

  async function handleLinkEmail() {
    if (!newEmail || !newPassword) return
    if (newPassword !== confirmPassword) {
      setEmailError('كلمتا المرور غير متطابقتين')
      return
    }
    setIsSendingEmail(true)
    setEmailError('')
    try {
      const res = await fetch('/api/auth/link-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword }),
      })
      const data = await res.json()
      if (data.success && !data.data?.error) {
        setEmailSent(true)
        setNewEmail('')
        setNewPassword('')
        setConfirmPassword('')
        await update({ refreshProfile: true })
      } else {
        setEmailError(data.data?.message || 'حدث خطأ')
      }
    } catch { setEmailError('حدث خطأ في الاتصال') }
    finally { setIsSendingEmail(false) }
  }

  async function handleChangePassword() {
    if (changeNewPassword !== confirmChangePassword) {
      setPasswordMessage({ type: 'error', text: 'كلمتا المرور غير متطابقتين' })
      return
    }
    if (changeNewPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
      return
    }

    setIsChangingPassword(true)
    setPasswordMessage(null)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword: changeNewPassword }),
      })
      const data = await res.json()
      if (data.success && !data.data?.error) {
        setPasswordMessage({ type: 'success', text: 'تم تغيير كلمة المرور بنجاح ✅' })
        setCurrentPassword('')
        setChangeNewPassword('')
        setConfirmChangePassword('')
      } else {
        setPasswordMessage({ type: 'error', text: data.data?.message || 'حدث خطأ' })
      }
    } catch { setPasswordMessage({ type: 'error', text: 'حدث خطأ في الاتصال' }) }
    finally { setIsChangingPassword(false) }
  }

  return (
    <div className="space-y-4">
      <AccountLinkingCard userEmail={userEmail} piUsername={piUsername} piUid={piUid} />

      {userEmail && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-1">تغيير البريد الإلكتروني 📧</h3>
          <p className="text-slate-400 text-xs mb-4">البريد الحالي: <span className="text-white">{userEmail}</span></p>

          {emailSent ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <p className="text-emerald-400 text-sm">✅ تم إرسال رابط التأكيد للبريد الجديد. تحقق من صندوق الوارد.</p>
            </div>
          ) : (
            <>
              {emailError && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {emailError}
                </div>
              )}
              <div className="flex gap-2">
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  placeholder="البريد الإلكتروني الجديد..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                <button onClick={handleChangeEmail} disabled={isSendingEmail || !newEmail}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all">
                  {isSendingEmail ? '...' : 'إرسال'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {userEmail && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">تغيير كلمة المرور 🔐</h3>

          {passwordMessage && (
            <div className={`mb-4 px-3 py-2 rounded-xl text-xs font-medium ${
              passwordMessage.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              {passwordMessage.text}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">كلمة المرور الحالية</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">كلمة المرور الجديدة</label>
              <input type="password" value={changeNewPassword} onChange={e => setChangeNewPassword(e.target.value)}
                placeholder="8 أحرف على الأقل"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">تأكيد كلمة المرور الجديدة</label>
              <input type="password" value={confirmChangePassword} onChange={e => setConfirmChangePassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
            </div>
            <button onClick={handleChangePassword}
              disabled={isChangingPassword || !currentPassword || !changeNewPassword || !confirmChangePassword}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all">
              {isChangingPassword ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
            </button>
          </div>
        </div>
      )}

      {!userEmail && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-2">ربط بريد إلكتروني 📧</h3>
          <p className="text-slate-400 text-sm mb-4">
            أضف بريداً وكلمة مرور لتسجيل الدخول بالبريد أو Pi — نفس الحساب.
          </p>

          {emailError && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {emailError}
            </div>
          )}

          {emailSent ? (
            <p className="text-emerald-400 text-sm">✅ تم ربط البريد. تحقق من صندوق الوارد لتأكيد البريد.</p>
          ) : (
            <div className="space-y-3">
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="البريد الإلكتروني..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="كلمة المرور (8+ أحرف، حرف كبير ورقم)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="تأكيد كلمة المرور"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
              <button onClick={handleLinkEmail} disabled={isSendingEmail || !newEmail || !newPassword}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all">
                {isSendingEmail ? 'جاري الربط...' : 'ربط البريد الإلكتروني'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
