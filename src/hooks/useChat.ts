'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CHAT_MESSAGES_POLL_MS, CHAT_ROOMS_POLL_MS } from '@/lib/chat/constants'

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
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [active, setActive] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)
  const latestMessageAtRef = useRef<string | null>(null)
  const activeRoomIdRef = useRef<string | null>(null)

  const fetchRooms = useCallback(async (silent = false) => {
    try {
      const res = await fetch('/api/chat', { cache: 'no-store' })
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
          return updated ?? null
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
    void fetchRooms()
  }, [status, router, fetchRooms])

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

  useEffect(() => {
    if (status !== 'authenticated' || !active) return

    const pollMessages = () => {
      if (document.hidden) return
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
  }, [status, active?.id, fetchMessages, fetchRooms])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !active || sending) return
    setSending(true)
    const text = input.trim()
    setInput('')
    try {
      const res = await fetch(`/api/chat/${active.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      const data = await res.json()
      if (data.data?.id) {
        const msg: ChatMessage = {
          id: data.data.id,
          senderId: session?.user?.id ?? '',
          content: text,
          createdAt: data.data.createdAt,
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

  const endConversation = useCallback(async () => {
    if (!active || closing) return false
    setClosing(true)
    try {
      const res = await fetch(`/api/chat/${active.id}/close`, { method: 'POST' })
      const data = await res.json()
      if (data.data?.closed) {
        setActive(null)
        setMessages([])
        setInput('')
        await fetchRooms(true)
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setClosing(false)
    }
  }, [active, closing, fetchRooms])

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
    endConversation,
    myId: session?.user?.id,
  }
}
