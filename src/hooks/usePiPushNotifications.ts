'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { isPiBrowser } from '@/lib/pi/pi-auth-client'
import { notificationActionPath } from '@/lib/notifications/routes'
import {
  isPushEnabledByUser,
  isPushSupported,
  loadSeenPushIds,
  PI_PUSH_POLL_HIDDEN_MS,
  PI_PUSH_POLL_VISIBLE_MS,
  saveSeenPushIds,
  setPushEnabledByUser,
} from '@/lib/notifications/push-config'

interface FeedNotification {
  id: string
  title: string
  body: string
  type: string
  createdAt: string
  data?: unknown
}

export function usePiPushNotifications() {
  const { status } = useSession()
  const router = useRouter()
  const [inPi, setInPi] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [pushEnabled, setPushEnabled] = useState(true)
  const sinceRef = useRef<string | null>(null)
  const seenRef = useRef<Set<string>>(loadSeenPushIds())

  useEffect(() => {
    setInPi(isPiBrowser())
    setPushEnabled(isPushEnabledByUser())
    if (isPushSupported()) {
      setPermission(Notification.permission)
    } else {
      setPermission('unsupported')
    }
  }, [])

  const showBrowserNotification = useCallback(
    (n: FeedNotification) => {
      if (!isPushSupported() || Notification.permission !== 'granted') return
      if (seenRef.current.has(n.id)) return

      seenRef.current.add(n.id)
      saveSeenPushIds(seenRef.current)

      try {
        const notification = new Notification(n.title, {
          body: n.body,
          tag: n.id,
          icon: '/favicon.ico',
          data: { id: n.id, type: n.type, payload: n.data },
        })

        notification.onclick = () => {
          window.focus()
          notification.close()
          const href = notificationActionPath(n.type, n.data)
          if (href) router.push(href)
        }
      } catch {
        /* Pi Browser may block in some contexts */
      }
    },
    [router],
  )

  const poll = useCallback(async () => {
    if (status !== 'authenticated' || !inPi || !pushEnabled) return
    if (!isPushSupported() || Notification.permission !== 'granted') return

    try {
      const hadSince = !!sinceRef.current
      const params = new URLSearchParams({ limit: '20' })
      if (sinceRef.current) params.set('since', sinceRef.current)

      const res = await fetch(`/api/notifications?${params}`, { cache: 'no-store' })
      const json = await res.json()
      const items: FeedNotification[] = json.data ?? []
      if (items.length === 0) return

      const latestAt = items.reduce((a, b) =>
        new Date(a.createdAt) > new Date(b.createdAt) ? a : b,
      ).createdAt

      if (!hadSince) {
        items.forEach(n => seenRef.current.add(n.id))
        saveSeenPushIds(seenRef.current)
        sinceRef.current = latestAt
        return
      }

      items.filter(n => !seenRef.current.has(n.id)).forEach(showBrowserNotification)
      sinceRef.current = latestAt
    } catch {
      /* ignore poll errors */
    }
  }, [status, inPi, pushEnabled, showBrowserNotification])

  useEffect(() => {
    if (status !== 'authenticated' || !inPi || !pushEnabled) return
    if (!isPushSupported() || Notification.permission !== 'granted') return

    let intervalId: number | undefined

    const schedule = () => {
      if (intervalId) clearInterval(intervalId)
      const ms = document.hidden ? PI_PUSH_POLL_HIDDEN_MS : PI_PUSH_POLL_VISIBLE_MS
      intervalId = window.setInterval(() => void poll(), ms)
    }

    void poll()
    schedule()

    const onVisibility = () => {
      schedule()
      void poll()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (intervalId) clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [status, inPi, pushEnabled, poll])

  async function requestPermission(): Promise<boolean> {
    if (!isPushSupported()) return false
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      setPushEnabledByUser(true)
      setPushEnabled(true)
      sinceRef.current = null
      seenRef.current = loadSeenPushIds()
      void poll()
    }
    return result === 'granted'
  }

  function disablePush() {
    setPushEnabledByUser(false)
    setPushEnabled(false)
  }

  return {
    inPi,
    permission,
    pushEnabled,
    pushSupported: permission !== 'unsupported',
    canPrompt: inPi && permission === 'default' && pushEnabled,
    requestPermission,
    disablePush,
  }
}
