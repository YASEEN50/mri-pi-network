'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getJitsiClientConfig } from '@/lib/appointments/online-video'

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

const scriptLoads = new Map<string, Promise<void>>()

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

function mediaErrorHint(err: unknown): string | null {
  if (!(err instanceof DOMException)) return null
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    return 'لم يُمنح الإذن بعد. اضغط «ابدأ المكالمة» مرة أخرى واختر «سماح»، أو افتح الصفحة في Chrome/Safari.'
  }
  if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    return 'لم يُعثر على كاميرا أو ميكروفون على هذا الجهاز.'
  }
  if (err.name === 'NotReadableError') {
    return 'الكاميرا أو الميكروفون مستخدمان من تطبيق آخر. أغلقه ثم أعد المحاولة.'
  }
  return null
}

/** محاولة اختيارية — لا نمنع Jitsi إذا فشلت (Pi Browser/WebView يفشل أحياناً هنا لكن Jitsi يعمل) */
async function tryWarmUpMedia(): Promise<string | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    stream.getTracks().forEach(t => t.stop())
    return null
  } catch (err) {
    return mediaErrorHint(err)
  }
}

export default function JitsiVideoEmbed({
  serverUrl,
  roomName,
  displayName,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<JitsiApi | null>(null)
  const [needsPermission, setNeedsPermission] = useState(true)
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  const domain = serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

  const startCall = useCallback(async () => {
    setPermissionWarning(null)
    setInitError(null)
    setLoading(true)

    const warmUpWarning = await tryWarmUpMedia()
    if (warmUpWarning) {
      setPermissionWarning(warmUpWarning)
    }

    try {
      await loadJitsiScript(serverUrl)
      const container = containerRef.current
      if (!container || !window.JitsiMeetExternalAPI) {
        throw new Error('jitsi_unavailable')
      }

      apiRef.current?.dispose()
      container.innerHTML = ''

      apiRef.current = new window.JitsiMeetExternalAPI(domain, {
        roomName,
        parentNode: container,
        width: '100%',
        height: '100%',
        userInfo: { displayName },
        ...getJitsiClientConfig(),
      })

      apiRef.current.addListener('readyToClose', () => {
        apiRef.current?.dispose()
        apiRef.current = null
      })

      setNeedsPermission(false)
    } catch {
      setInitError('تعذر تحميل مكالمة الفيديو. تحقق من الاتصال وحاول مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }, [domain, displayName, roomName, serverUrl])

  useEffect(() => () => {
    apiRef.current?.dispose()
    apiRef.current = null
  }, [])

  function openInBrowser() {
    window.open(window.location.href, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className={
        className ??
        'relative w-full min-h-[70vh] md:min-h-[520px] bg-black/40 rounded-2xl overflow-hidden border border-white/10'
      }
    >
      {needsPermission ? (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center gap-4">
          <div className="text-5xl">📹</div>
          <p className="text-white font-medium">مكالمة فيديو داخل التطبيق</p>
          <p className="text-slate-400 text-sm max-w-md">
            اضغط «ابدأ المكالمة». ستظهر نافذة Jitsi — اختر «سماح» للكاميرا والميكروفون من هناك.
          </p>
          {permissionWarning && (
            <p className="text-amber-400 text-sm max-w-md">{permissionWarning}</p>
          )}
          {initError && (
            <p className="text-red-400 text-sm max-w-md">{initError}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => void startCall()}
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm transition-all"
            >
              {loading ? 'جاري التحضير...' : 'ابدأ المكالمة'}
            </button>
            <button
              type="button"
              onClick={openInBrowser}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition-all"
            >
              فتح في المتصفح
            </button>
          </div>
        </div>
      ) : (
        loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        )
      )}
      <div ref={containerRef} className="w-full h-full min-h-[70vh] md:min-h-[520px]" />
    </div>
  )
}
