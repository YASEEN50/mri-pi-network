'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isPiBrowser } from '@/lib/pi/pi-auth-client'
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
  returnUrl?: string
  className?: string
}

const IFRAME_ALLOW = 'camera; microphone; fullscreen; display-capture; autoplay; clipboard-write'

const scriptLoads = new Map<string, Promise<void>>()

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
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

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function resolveAbsoluteReturnUrl(returnUrl?: string): string | undefined {
  if (!returnUrl) return undefined
  if (/^https?:\/\//i.test(returnUrl)) return returnUrl
  if (typeof window === 'undefined') return undefined
  return new URL(returnUrl, window.location.origin).href
}

export default function JitsiVideoEmbed({
  serverUrl,
  roomName,
  displayName,
  returnUrl,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<JitsiApi | null>(null)
  const patchCleanupRef = useRef<(() => void) | null>(null)
  const [mode, setMode] = useState<'choose' | 'embedded'>('choose')
  const [loading, setLoading] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [inPi] = useState(() => isPiBrowser())
  const [onMobile] = useState(() => isMobileDevice())

  const domain = serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

  const absoluteReturnUrl = useMemo(
    () => resolveAbsoluteReturnUrl(returnUrl),
    [returnUrl],
  )

  const meetingUrl = useMemo(
    () => getJitsiDirectJoinUrl(roomName, displayName, absoluteReturnUrl),
    [roomName, displayName, absoluteReturnUrl],
  )

  const joinDirect = useCallback(() => {
    window.location.href = meetingUrl
  }, [meetingUrl])

  const openExternal = useCallback(() => {
    window.open(meetingUrl, '_blank', 'noopener,noreferrer')
  }, [meetingUrl])

  const copyMeetingLink = useCallback(async () => {
    const ok = await copyText(meetingUrl)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 3000)
  }, [meetingUrl])

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
        ...getJitsiClientConfig(absoluteReturnUrl),
      })

      patchCleanupRef.current = patchJitsiIframe(container)

      apiRef.current.addListener('readyToClose', () => {
        if (absoluteReturnUrl) window.location.href = absoluteReturnUrl
      })
    } catch {
      setInitError('تعذر تحميل المكالمة المدمجة.')
      setMode('choose')
    } finally {
      setLoading(false)
    }
  }, [absoluteReturnUrl, domain, displayName, roomName, serverUrl])

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

          {inPi ? (
            <div className="max-w-md rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-right space-y-2">
              <p className="text-amber-300 text-sm font-medium">
                ⚠️ Pi Browser لا يدعم الكاميرا داخل التطبيق
              </p>
              <p className="text-slate-300 text-xs leading-relaxed">
                1. اضغط «فتح في Chrome» أو «نسخ الرابط»<br />
                2. الصق الرابط في <strong>Chrome</strong> أو <strong>Safari</strong><br />
                3. اضغط «انضم للملتقى» ثم «سماح» للكاميرا والميكروفون
              </p>
            </div>
          ) : onMobile ? (
            <p className="text-slate-400 text-sm max-w-md">
              اضغط «انضم للمكالمة» ثم «سماح» للكاميرا والميكروفون في شاشة Jitsi.
            </p>
          ) : (
            <p className="text-slate-400 text-sm max-w-md">
              اختر طريقة الانضمام. يُفضّل Chrome أو Edge على الكمبيوتر.
            </p>
          )}

          {initError && <p className="text-amber-400 text-sm max-w-md">{initError}</p>}
          {copied && <p className="text-emerald-400 text-sm">✓ تم نسخ رابط المكالمة</p>}

          <div className="flex flex-col w-full max-w-sm gap-3">
            {inPi ? (
              <>
                <button
                  type="button"
                  onClick={openExternal}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all"
                >
                  🌐 فتح في Chrome / Safari
                </button>
                <button
                  type="button"
                  onClick={() => void copyMeetingLink()}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all"
                >
                  📋 نسخ رابط المكالمة
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={joinDirect}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all"
              >
                ✅ انضم للمكالمة
              </button>
            )}

            {!inPi && onMobile && (
              <button
                type="button"
                onClick={openExternal}
                className="px-6 py-3 rounded-xl bg-blue-600/80 hover:bg-blue-500 text-white text-sm transition-all"
              >
                فتح في متصفح خارجي
              </button>
            )}

            {!inPi && (
              <button
                type="button"
                onClick={() => void copyMeetingLink()}
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition-all"
              >
                📋 نسخ رابط المكالمة
              </button>
            )}

            {!inPi && !onMobile && (
              <button
                type="button"
                onClick={() => void startEmbedded()}
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white text-sm transition-all"
              >
                {loading ? 'جاري التحضير...' : 'انضم داخل الصفحة'}
              </button>
            )}
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
            onClick={openExternal}
            className="px-3 py-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-medium"
          >
            ⚠️ الكاميرا لا تعمل؟ افتح في Chrome
          </button>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full min-h-[70vh] md:min-h-[520px]" />
    </div>
  )
}
