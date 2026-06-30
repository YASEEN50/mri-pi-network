'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getJitsiClientConfig,
  getJitsiDirectJoinUrl,
} from '@/lib/appointments/online-video'

type JitsiApi = {
  dispose: () => void
  addListener: (event: string, fn: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: Record<string, unknown>,
    ) => JitsiApi
  }
}

interface Props {
  serverUrl: string
  roomName: string
  displayName: string
  className?: string
}

const IFRAME_ALLOW = 'camera; microphone; fullscreen; display-capture; autoplay; clipboard-write'

const scriptLoads = new Map<string, Promise<void>>()

function isMobileOrEmbedded(): boolean {
  if (typeof window === 'undefined') return false
  const embedded = window.self !== window.top
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const pi = /PiBrowser|minepi|pi network/i.test(navigator.userAgent)
  return embedded || mobile || pi
}

function loadJitsiScript(serverUrl: string): Promise<void> {
  const base = serverUrl.replace(/\/$/, '')
  const existing = scriptLoads.get(base)
  if (existing) return existing

  const promise = new Promise<void>((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = `${base}/external_api.js`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('jitsi_script_failed'))
    document.body.appendChild(script)
  })
  scriptLoads.set(base, promise)
  return promise
}

function patchJitsiIframe(container: HTMLElement): () => void {
  const apply = () => {
    container.querySelectorAll('iframe').forEach(iframe => {
      iframe.setAttribute('allow', IFRAME_ALLOW)
      iframe.setAttribute('allowfullscreen', 'true')
    })
  }
  apply()
  const observer = new MutationObserver(apply)
  observer.observe(container, { childList: true, subtree: true })
  return () => observer.disconnect()
}

export default function JitsiVideoEmbed({
  serverUrl,
  roomName,
  displayName,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<JitsiApi | null>(null)
  const patchCleanupRef = useRef<(() => void) | null>(null)
  const [mode, setMode] = useState<'choose' | 'embedded'>('choose')
  const [loading, setLoading] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [preferDirect] = useState(() => isMobileOrEmbedded())

  const domain = serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

  const directJoinUrl = getJitsiDirectJoinUrl(roomName, displayName)

  const joinDirect = useCallback(() => {
    window.location.href = directJoinUrl
  }, [directJoinUrl])

  const startEmbedded = useCallback(async () => {
    setInitError(null)
    setLoading(true)
    setMode('embedded')

    try {
      await loadJitsiScript(serverUrl)
      const container = containerRef.current
      if (!container || !window.JitsiMeetExternalAPI) {
        throw new Error('jitsi_unavailable')
      }

      apiRef.current?.dispose()
      patchCleanupRef.current?.()
      container.innerHTML = ''

      apiRef.current = new window.JitsiMeetExternalAPI(domain, {
        roomName,
        parentNode: container,
        width: '100%',
        height: '100%',
        userInfo: { displayName },
        ...getJitsiClientConfig(),
      })

      patchCleanupRef.current = patchJitsiIframe(container)

      apiRef.current.addListener('readyToClose', () => {
        apiRef.current?.dispose()
        apiRef.current = null
      })
    } catch {
      setInitError('تعذر تحميل المكالمة المدمجة. استخدم «انضم مباشرة» — يعمل أفضل على الموبايل.')
      setMode('choose')
    } finally {
      setLoading(false)
    }
  }, [domain, displayName, roomName, serverUrl])

  useEffect(() => () => {
    patchCleanupRef.current?.()
    apiRef.current?.dispose()
    apiRef.current = null
  }, [])

  return (
    <div
      className={
        className ??
        'relative w-full min-h-[70vh] md:min-h-[520px] bg-black/40 rounded-2xl overflow-hidden border border-white/10'
      }
    >
      {mode === 'choose' && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center gap-4">
          <div className="text-5xl">📹</div>
          <p className="text-white font-medium">انضم لمكالمة الفيديو</p>
          <p className="text-slate-400 text-sm max-w-md">
            {preferDirect
              ? 'على الموبايل/Pi Browser: اختر «انضم مباشرة» ثم اضغط «سماح» للكاميرا والميكروفون في شاشة Jitsi.'
              : 'اختر طريقة الانضمام. عند ظهور شاشة Jitsi اضغط «سماح» للكاميرا والميكروفون.'}
          </p>
          {initError && (
            <p className="text-amber-400 text-sm max-w-md">{initError}</p>
          )}
          <div className="flex flex-col w-full max-w-sm gap-3">
            <button
              type="button"
              onClick={joinDirect}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all"
            >
              {preferDirect ? '✅ انضم مباشرة (موصى به)' : 'انضم مباشرة'}
            </button>
            <button
              type="button"
              onClick={() => void startEmbedded()}
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white text-sm transition-all"
            >
              {loading ? 'جاري التحضير...' : 'انضم داخل الصفحة'}
            </button>
          </div>
        </div>
      )}

      {mode === 'embedded' && loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      )}

      {mode === 'embedded' && !loading && (
        <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={joinDirect}
            className="px-3 py-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-medium"
          >
            ⚠️ الكاميرا لا تعمل؟ انضم مباشرة
          </button>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full min-h-[70vh] md:min-h-[520px]" />
    </div>
  )
}
