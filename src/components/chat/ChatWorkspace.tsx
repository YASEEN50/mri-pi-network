'use client'

import { useEffect, useRef } from 'react'
import Navbar from '@/components/common/Navbar'
import { useChat } from '@/hooks/useChat'

interface ChatWorkspaceProps {
  emptyRoomsHint: string
  otherPartyFallback: string
}

export default function ChatWorkspace({
  emptyRoomsHint,
  otherPartyFallback,
}: ChatWorkspaceProps) {
  const {
    rooms,
    active,
    setActive,
    messages,
    input,
    setInput,
    loading,
    sending,
    sendMessage,
    myId,
  } = useChat()

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col" dir="rtl">
      <Navbar locale="ar" />
      <div
        className="flex flex-1 max-w-5xl mx-auto w-full px-4 py-6 gap-4"
        style={{ height: 'calc(100vh - 64px)' }}
      >
        <div className="w-72 flex-shrink-0 bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
            <h2 className="text-white font-semibold text-sm">المحادثات</h2>
            <span className="text-slate-600 text-[10px]" title="تحديث تلقائي">● مباشر</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {rooms.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm px-4">{emptyRoomsHint}</div>
            ) : (
              rooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => setActive(room)}
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
                        {room.lastMessage ?? 'لا توجد رسائل'}
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

        <div className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col">
          {active ? (
            <>
              <div className="px-5 py-4 border-b border-white/[0.08] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-medium text-blue-400">
                  {active.otherParty?.name?.[0] ?? '?'}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">
                    {active.otherParty?.name ?? otherPartyFallback}
                  </p>
                  {active.otherParty?.specialization && (
                    <p className="text-slate-400 text-xs">{active.otherParty.specialization}</p>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(msg => {
                  const isMe = msg.senderId === myId
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm
                          ${isMe
                            ? 'bg-emerald-500/20 text-white rounded-tr-sm'
                            : 'bg-white/10 text-white rounded-tl-sm'}`}
                      >
                        {msg.content}
                        <p className="text-xs opacity-50 mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString('ar-SA', {
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

              <div className="p-4 border-t border-white/[0.08] flex gap-3">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && void sendMessage()}
                  placeholder="اكتب رسالتك..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder-slate-500"
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || sending}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all"
                >
                  {sending ? '...' : 'إرسال'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              اختر محادثة من القائمة
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
