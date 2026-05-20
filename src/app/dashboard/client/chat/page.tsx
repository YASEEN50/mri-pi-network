'use client'
// src/app/dashboard/client/chat/page.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/common/Navbar'

interface Room { id: string; otherParty: any; lastMessage: string | null; lastMessageAt: string; unreadCount: number }
interface Message { id: string; senderId: string; content: string; createdAt: string; fileUrl?: string }

export default function ClientChatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [rooms,   setRooms]   = useState<Room[]>([])
  const [active,  setActive]  = useState<Room | null>(null)
  const [messages,setMessages]= useState<Message[]>([])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchRooms = useCallback(async () => {
    try {
      const res  = await fetch('/api/chat')
      const data = await res.json()
      const list = data.data ?? []
      setRooms(list)
      setActive(prev => (list.length > 0 && prev === null ? list[0] : prev))
    } catch {}
    finally { setLoading(false) }
  }, [])

  const fetchMessages = useCallback(async (roomId: string) => {
    try {
      const res  = await fetch(`/api/chat/${roomId}`)
      const data = await res.json()
      setMessages(data.data ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'loading') return
    void fetchRooms()
  }, [status, router, fetchRooms])

  useEffect(() => {
    if (active) void fetchMessages(active.id)
  }, [active, fetchMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || !active || sending) return
    setSending(true)
    const text = input.trim()
    setInput('')
    try {
      const res  = await fetch(`/api/chat/${active.id}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: text }),
      })
      const data = await res.json()
      if (data.data?.id) {
        setMessages(p => [...p, { id: data.data.id, senderId: session?.user?.id ?? '', content: text, createdAt: data.data.createdAt }])
        fetchRooms()
      }
    } catch {}
    finally { setSending(false) }
  }

  const myId = session?.user?.id

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col" dir="rtl">
      <Navbar locale="ar" />
      <div className="flex flex-1 max-w-5xl mx-auto w-full px-4 py-6 gap-4" style={{ height: 'calc(100vh - 64px)' }}>

        {/* قائمة المحادثات */}
        <div className="w-72 flex-shrink-0 bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/[0.08]">
            <h2 className="text-white font-semibold text-sm">المحادثات</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {rooms.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm px-4">
                لا توجد محادثات بعد. احجز موعداً مع طبيب للبدء.
              </div>
            ) : rooms.map(room => (
              <button key={room.id} onClick={() => setActive(room)}
                className={`w-full text-right px-4 py-3 border-b border-white/[0.05] hover:bg-white/[0.03] transition-all
                  ${active?.id === room.id ? 'bg-emerald-500/10' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-medium text-blue-400 flex-shrink-0">
                    {room.otherParty?.name?.[0] ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{room.otherParty?.name ?? 'طبيب'}</p>
                    <p className="text-slate-500 text-xs truncate">{room.lastMessage ?? 'لا توجد رسائل'}</p>
                  </div>
                  {room.unreadCount > 0 && (
                    <span className="w-5 h-5 bg-emerald-500 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0">
                      {room.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* نافذة المحادثة */}
        <div className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col">
          {active ? (
            <>
              {/* Header */}
              <div className="px-5 py-4 border-b border-white/[0.08] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-medium text-blue-400">
                  {active.otherParty?.name?.[0] ?? '?'}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{active.otherParty?.name}</p>
                  {active.otherParty?.specialization && (
                    <p className="text-slate-400 text-xs">{active.otherParty.specialization}</p>
                  )}
                </div>
              </div>

              {/* الرسائل */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(msg => {
                  const isMe = msg.senderId === myId
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm
                        ${isMe
                          ? 'bg-emerald-500/20 text-white rounded-tr-sm'
                          : 'bg-white/10 text-white rounded-tl-sm'}`}>
                        {msg.content}
                        <p className="text-xs opacity-50 mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* إدخال الرسالة */}
              <div className="p-4 border-t border-white/[0.08] flex gap-3">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="اكتب رسالتك..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder-slate-500"
                />
                <button onClick={sendMessage} disabled={!input.trim() || sending}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all">
                  إرسال
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
