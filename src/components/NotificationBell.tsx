'use client'
// src/components/NotificationBell.tsx — محدّث مع mark-as-read وحذف

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface Notification {
  id:        string
  title:     string
  body:      string
  type:      string
  isRead:    boolean
  createdAt: string
}

const TYPE_ICONS: Record<string, string> = {
  APPOINTMENT_CONFIRMED:      '✅',
  APPOINTMENT_CANCELLED:      '❌',
  APPOINTMENT_REMINDER:       '⏰',
  DOCTOR_APPROVED:            '👨‍⚕️',
  DOCTOR_REJECTED:            '⚠️',
  DOCTOR_PENDING_REVIEW:      '📋',
  AI_VERIFICATION_COMPLETE:   '🤖',
  FACILITY_DOCTOR_APPROVED:   '🏥',
  AI_APPROVED:                '🤖',
  AI_REJECTED:                '🔴',
  VERIFIED:                   '🏅',
  REJECTED:                   '❌',
  DEFAULT:                    '🔔',
}

export default function NotificationBell() {
  const { data: session } = useSession()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open,          setOpen]          = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => !n.isRead).length

  useEffect(() => {
    if (!session) return
    load()
    const timer = setInterval(load, 60_000)
    return () => clearInterval(timer)
  }, [session])

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  async function load() {
    try {
      const res  = await fetch('/api/notifications')
      const data = await res.json()
      setNotifications(data.data ?? [])
    } catch {}
  }

  async function markRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
      setNotifications(p => p.map(n => n.id === id ? { ...n, isRead: true } : n))
    } catch {}
  }

  async function markAllRead() {
    try {
      await fetch('/api/notifications', { method: 'PATCH' })
      setNotifications(p => p.map(n => ({ ...n, isRead: true })))
    } catch {}
  }

  async function deleteNotification(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
      setNotifications(p => p.filter(n => n.id !== id))
    } catch {}
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 w-80 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 end-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="font-semibold text-white text-sm">الإشعارات</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          {/* القائمة */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">لا توجد إشعارات</div>
            ) : (
              notifications.slice(0, 15).map(n => (
                <div key={n.id}
                  onClick={() => !n.isRead && markRead(n.id)}
                  className={`px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-all cursor-pointer group
                    ${!n.isRead ? 'bg-emerald-500/5' : ''}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-base flex-shrink-0">{TYPE_ICONS[n.type] ?? TYPE_ICONS.DEFAULT}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{n.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                      <p className="text-xs text-slate-600 mt-1">{new Date(n.createdAt).toLocaleDateString('ar-SA')}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!n.isRead && <div className="w-2 h-2 bg-emerald-400 rounded-full" />}
                      <button
                        onClick={e => deleteNotification(n.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all text-xs px-1">
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
