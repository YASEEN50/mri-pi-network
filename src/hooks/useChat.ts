'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CHAT_MESSAGES_POLL_MS, CHAT_ROOMS_POLL_MS } from '@/lib/chat/constants'

export type ChatRoomFilter = 'active' | 'closed'

export interface ChatRoom {
  id: string
  status?: 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
  otherParty: { name?: string; specialization?: string; avatarUrl?: string } | null
  lastMessage: string | null
  lastMessageAt: string
  unreadCount: number
}

export interface ChatMessage {
  id: string
  senderId: string
  content: string
  createdAt: string
  fileUrl?: string
}

function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return prev
  const byId = new Map(prev.map(m => [m.id, m]))
  for (const msg of incoming) byId.set(msg.id, msg)
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

export function useChat() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomFromUrl = searchParams.get('room')
  const [roomFilter, setRoomFilter] = useState<ChatRoomFilter>('active')
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [active, setActive] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)
  const latestMessageAtRef = useRef<string | null>(null)
  const activeRoomIdRef = useRef<string | null>(null)
  const sseConnectedRef = useRef(false)
  const roomFilterRef = useRef(roomFilter)

  useEffect(() => {
    roomFilterRef.current = roomFilter
  }, [roomFilter])

  const fetchRooms = useCallback(async (silent = false, filter?: ChatRoomFilter) => {
    const f = filter ?? roomFilterRef.current
    try {
      const res = await fetch(`/api/chat?filter=${f}`, { cache: 'no-store' })
      const data = await res.json()
      const list: ChatRoom[] = data.data ?? []
      setRooms(list)
      setActive(prev => {
        if (roomFromUrl) {
          const fromUrl = list.find(r => r.id === roomFromUrl)
          if (fromUrl) return fromUrl
        }
        if (prev) {
          const updated = list.find(r => r.id === prev.id)
          return updated ?? (f === 'closed' ? prev : null)
        }
        return list.length > 0 ? list[0] : null
      })
    } catch { /* ignore */ }
    finally {
      if (!silent) setLoading(false)
    }
  }, [roomFromUrl])

  useEffect(() => {
    if (!roomFromUrl || rooms.length === 0) return
    const match = rooms.find(r => r.id === roomFromUrl)
    if (match) setActive(match)
  }, [roomFromUrl, rooms])

  const fetchMessages = useCallback(async (roomId: string, since?: string | null) => {
    try {
      const params = new URLSearchParams()
      if (since) params.set('since', since)
      else params.set('limit', '50')

      const res = await fetch(`/api/chat/${roomId}?${params}`, { cache: 'no-store' })
      const data = await res.json()
      const list: ChatMessage[] = data.data ?? []
      if (!list.length) return

      if (since) {
        setMessages(prev => {
          const merged = mergeMessages(prev, list)
          const latest = merged[merged.length - 1]
          if (latest) latestMessageAtRef.current = latest.createdAt
          return merged
        })
      } else {
        setMessages(list)
        const latest = list[list.length - 1]
        if (latest) latestMessageAtRef.current = latest.createdAt
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'loading') return
    void fetchRooms(false, roomFilter)
  }, [status, router, fetchRooms, roomFilter])

  useEffect(() => {
    if (!active) {
      activeRoomIdRef.current = null
      latestMessageAtRef.current = null
      setMessages([])
      return
    }

    activeRoomIdRef.current = active.id
    latestMessageAtRef.current = null
    void fetchMessages(active.id)
  }, [active?.id, fetchMessages])

  useEffect(() => {
    if (active?.id) return
    void fetch('/api/chat/presence', { method: 'DELETE' }).catch(() => {})
  }, [active?.id])

  // SSE — live messages for active rooms
  useEffect(() => {
    if (status !== 'authenticated' || !active || active.status === 'CLOSED') {
      sseConnectedRef.current = false
      return
    }

    const roomId = active.id
    const since = latestMessageAtRef.current ?? ''
    const es = new EventSource(
      `/api/chat/${roomId}/stream?since=${encodeURIComponent(since)}`,
    )

    es.onopen = () => {
      sseConnectedRef.current = true
    }

    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data) as {
          type?: string
          message?: ChatMessage
        }
        if (payload.type === 'message' && payload.message) {
          setMessages(prev => mergeMessages(prev, [payload.message!]))
          latestMessageAtRef.current = payload.message.createdAt
          void fetchRooms(true)
        }
      } catch { /* ignore */ }
    }

    es.onerror = () => {
      sseConnectedRef.current = false
      es.close()
    }

    return () => {
      sseConnectedRef.current = false
      es.close()
    }
  }, [status, active?.id, active?.status, fetchRooms])

  // Fallback polling when SSE unavailable
  useEffect(() => {
    if (status !== 'authenticated' || !active) return
    if (active.status === 'CLOSED') return

    const pollMessages = () => {
      if (document.hidden || sseConnectedRef.current) return
      const roomId = activeRoomIdRef.current
      if (!roomId) return
      void fetchMessages(roomId, latestMessageAtRef.current)
    }

    const pollRooms = () => {
      if (document.hidden) return
      void fetchRooms(true)
    }

    const msgTimer = window.setInterval(pollMessages, CHAT_MESSAGES_POLL_MS)
    const roomsTimer = window.setInterval(pollRooms, CHAT_ROOMS_POLL_MS)

    const onVisible = () => {
      if (!document.hidden) {
        pollMessages()
        pollRooms()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(msgTimer)
      window.clearInterval(roomsTimer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [status, active?.id, active?.status, fetchMessages, fetchRooms])

  const sendMessage = useCallback(async (opts?: { fileUrl?: string; fileType?: string; content?: string }) => {
    const text = (opts?.content ?? input).trim()
    const hasFile = !!opts?.fileUrl
    if ((!text && !hasFile) || !active || active.status === 'CLOSED' || sending) return
    setSending(true)
    setInput('')
    try {
      const res = await fetch(`/api/chat/${active.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text || (hasFile ? '📎 مرفق' : ''),
          fileUrl: opts?.fileUrl,
          fileType: opts?.fileType,
        }),
      })
      const data = await res.json()
      if (data.data?.id) {
        const msg: ChatMessage = {
          id: data.data.id,
          senderId: session?.user?.id ?? '',
          content: text || '📎 مرفق',
          createdAt: data.data.createdAt,
          fileUrl: opts?.fileUrl,
        }
        setMessages(prev => mergeMessages(prev, [msg]))
        latestMessageAtRef.current = msg.createdAt
        void fetchRooms(true)
      }
    } catch { /* ignore */ }
    finally {
      setSending(false)
    }
  }, [input, active, sending, session?.user?.id, fetchRooms])

  const uploadAttachment = useCallback(async (file: File) => {
    if (!active || active.status === 'CLOSED' || sending) return
    setSending(true)
    const caption = input.trim()
    setInput('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const up = await fetch(`/api/chat/${active.id}/upload`, { method: 'POST', body: fd })
      const upData = await up.json()
      if (!upData.data?.fileUrl) return

      const res = await fetch(`/api/chat/${active.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: caption || '📎 مرفق',
          fileUrl: upData.data.fileUrl,
          fileType: upData.data.fileType,
        }),
      })
      const data = await res.json()
      if (data.data?.id) {
        const msg: ChatMessage = {
          id: data.data.id,
          senderId: session?.user?.id ?? '',
          content: caption || '📎 مرفق',
          createdAt: data.data.createdAt,
          fileUrl: upData.data.fileUrl,
        }
        setMessages(prev => mergeMessages(prev, [msg]))
        latestMessageAtRef.current = msg.createdAt
        void fetchRooms(true)
      }
    } catch { /* ignore */ }
    finally {
      setSending(false)
    }
  }, [active, sending, input, session?.user?.id, fetchRooms])

  const endConversation = useCallback(async () => {
    if (!active || closing) return false
    setClosing(true)
    try {
      const res = await fetch(`/api/chat/${active.id}/close`, { method: 'POST' })
      const data = await res.json()
      if (data.data?.closed) {
        const closedRoom: ChatRoom = { ...active, status: 'CLOSED', unreadCount: 0 }
        setRoomFilter('closed')
        setActive(closedRoom)
        await fetchRooms(true, 'closed')
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setClosing(false)
    }
  }, [active, closing, fetchRooms])

  const isReadOnly = (active?.status ?? 'ACTIVE') === 'CLOSED'

  return {
    session,
    status,
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
    uploadAttachment,
    endConversation,
    roomFilter,
    setRoomFilter,
    isReadOnly,
    myId: session?.user?.id,
  }
}
