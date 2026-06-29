'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { useChat } from '@/hooks/useChat'
import { useAppLocale } from '@/hooks/useAppLocale'

interface ChatWorkspaceProps {
  variant?: 'client' | 'doctor'
}

export default function ChatWorkspace({ variant = 'client' }: ChatWorkspaceProps) {
  const t = useTranslations('dashboard.chat')
  const td = useTranslations('dashboard.doctor')
  const { dateLocale, locale } = useAppLocale()
  const {
    rooms,
    active,
    setActive,
    messages,
    input,
    setInput,
    loading,
    sending,
    closing,
    sendMessage,
    endConversation,
    uploadAttachment,
    myId,
  } = useChat()

  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [videoPath, setVideoPath] = useState<string | null>(null)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const otherPartyFallback =
    variant === 'doctor' ? td('patient_fallback') : t('doctor_fallback')
  const emptyRoomsHint =
    variant === 'doctor' ? td('empty_chat_hint') : t('client_empty_hint')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (active) setMobileChatOpen(true)
  }, [active?.id])

  useEffect(() => {
    if (!active?.id) {
      setVideoPath(null)
      return
    }
    fetch(`/api/chat/${active.id}/video`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.canJoin && d.data.videoPath) setVideoPath(d.data.videoPath)
        else setVideoPath(null)
      })
      .catch(() => setVideoPath(null))
  }, [active?.id])

  function openRoom(room: (typeof rooms)[0]) {
    setActive(room)
    setMobileChatOpen(true)
  }

  async function handleEndConversation() {
    const ok = await endConversation()
    setShowEndConfirm(false)
    if (ok) setMobileChatOpen(false)
  }

  const endConfirmText =
    variant === 'doctor' ? t('end_confirm_doctor') : t('end_confirm')

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <DashboardShell className="min-h-screen bg-slate-950 flex flex-col">
      <div className="flex flex-1 min-h-0 max-w-5xl mx-auto w-full px-2 sm:px-4 py-3 sm:py-6 gap-2 sm:gap-4">
        {/* Room list — full width on mobile when chat closed */}
        <div
          className={`flex flex-col bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden min-h-0
            w-full md:w-72 md:flex-shrink-0
            ${mobileChatOpen ? 'hidden md:flex' : 'flex'}
            md:max-h-[calc(100dvh-7rem)]`}
        >
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
            <h2 className="text-white font-semibold text-sm">{t('title')}</h2>
            <span className="text-slate-600 text-[10px]" title={t('live_title')}>{t('live')}</span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {rooms.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm px-4">{emptyRoomsHint}</div>
            ) : (
              rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => openRoom(room)}
                  className={`w-full text-right px-4 py-3 border-b border-white/[0.05] hover:bg-white/[0.03] transition-all
                    ${active?.id === room.id ? 'bg-emerald-500/10' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-medium text-blue-400 flex-shrink-0">
                      {room.otherParty?.name?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {room.otherParty?.name ?? otherPartyFallback}
                      </p>
                      <p className="text-slate-500 text-xs truncate">
                        {room.lastMessage ?? t('no_messages')}
                      </p>
                    </div>
                    {room.unreadCount > 0 && (
                      <span className="w-5 h-5 bg-emerald-500 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0">
                        {room.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div
          className={`flex-1 flex flex-col min-h-0 min-w-0 bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden
            ${mobileChatOpen ? 'flex' : 'hidden md:flex'}
            max-h-[calc(100dvh-7rem)] md:max-h-[calc(100dvh-7rem)]`}
        >
          {active ? (
            <>
              <div className="px-3 sm:px-5 py-3 border-b border-white/[0.08] flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="md:hidden p-2 text-slate-400 hover:text-white"
                  onClick={() => setMobileChatOpen(false)}
                  aria-label={t('back_to_list')}
                >
                  →
                </button>
                <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-medium text-blue-400 shrink-0">
                  {active.otherParty?.name?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {active.otherParty?.name ?? otherPartyFallback}
                  </p>
                  {active.otherParty?.specialization && (
                    <p className="text-slate-400 text-xs truncate">{active.otherParty.specialization}</p>
                  )}
                </div>
                {videoPath && (
                  <Link
                    href={videoPath}
                    className="shrink-0 px-3 py-2 rounded-xl bg-purple-600/80 hover:bg-purple-500 text-white text-xs font-medium"
                  >
                    📹 {t('video')}
                  </Link>
                )}
                {(active.status ?? 'ACTIVE') === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => setShowEndConfirm(true)}
                    disabled={closing}
                    className="shrink-0 px-3 py-2 rounded-xl bg-red-600/80 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-medium"
                  >
                    {closing ? t('ending') : t('end_conversation')}
                  </button>
                )}
              </div>

              {showEndConfirm && (
                <div className="px-3 sm:px-5 py-3 bg-red-500/10 border-b border-red-500/20 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                  <p className="text-red-200 text-sm flex-1">{endConfirmText}</p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleEndConversation()}
                      disabled={closing}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-medium disabled:opacity-50"
                    >
                      {closing ? t('ending') : t('end_conversation')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEndConfirm(false)}
                      disabled={closing}
                      className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs"
                    >
                      {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 min-h-0">
                {messages.length === 0 && (
                  <p className="text-center text-slate-500 text-sm py-8">{t('no_messages')}</p>
                )}
                {messages.map((msg) => {
                  const isMe = msg.senderId === myId
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[85%] sm:max-w-xs px-4 py-2.5 rounded-2xl text-sm break-words
                          ${isMe
                            ? 'bg-emerald-500/20 text-white rounded-tr-sm'
                            : 'bg-white/10 text-white rounded-tl-sm'}`}
                      >
                        {msg.content}
                        {msg.fileUrl && (
                          <a
                            href={msg.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block mt-2 text-xs text-emerald-300 underline break-all"
                          >
                            📎 {t('attachment')}
                          </a>
                        )}
                        <p className="text-xs opacity-50 mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString(dateLocale, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <div
                className="shrink-0 p-3 sm:p-4 border-t border-white/[0.08] bg-slate-950/95 flex gap-2 sm:gap-3 items-end"
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void uploadAttachment(f)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  className="shrink-0 p-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white disabled:opacity-40"
                  aria-label={t('attachment')}
                >
                  📎
                </button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void sendMessage()
                    }
                  }}
                  placeholder={t('placeholder')}
                  className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-500/50 placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || sending}
                  className="shrink-0 min-w-[4.5rem] px-4 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-all"
                >
                  {sending ? '...' : t('send')}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm p-4">
              {t('select_room')}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}
