'use client'

import { signIn } from 'next-auth/react'
import { resolvePiSandbox } from '@/lib/pi/sandbox-detect'
import { PI_AUTH_SCOPES } from '@/lib/pi/pi-scopes'
import { resolveIncompletePiPayment } from '@/lib/pi/resolve-incomplete-payment'

export const PI_SKIP_AUTO_LOGIN_KEY = 'pi_skip_auto_login'

let initSandbox: boolean | null = null

/** Heuristics: Pi Browser WebView, sandbox iframe, or native Pi SDK present */
export function isPiBrowser(): boolean {
  if (typeof window === 'undefined') return false

  if (typeof window.Pi !== 'undefined') return true

  const ua = navigator.userAgent.toLowerCase()
  if (/pibrowser|pi browser|pinetwork|minepi|pi app|pi\s+browser/i.test(ua)) return true

  try {
    const ref = (document.referrer || '').toLowerCase()
    if (/minepi\.com|pi\.network|sandbox\.minepi/.test(ref)) return true
  } catch { /* ignore */ }

  // Pi Browser embeds apps in a cross-origin iframe from minepi.com
  try {
    if (window.self !== window.top) {
      const ref = (document.referrer || '').toLowerCase()
      if (ref === '' || /minepi|pi\.network/.test(ref)) return true
    }
  } catch {
    // cross-origin parent — typical Pi embed
    return true
  }

  return false
}

/** Wait until Pi SDK is available (native inject or script load) */
export async function isPiBrowserReady(timeoutMs = 12_000): Promise<boolean> {
  try {
    await waitForPiSdk(timeoutMs)
    return typeof window.Pi !== 'undefined'
  } catch {
    return isPiBrowser()
  }
}

export function markExplicitLogout(): void {
  try { sessionStorage.setItem(PI_SKIP_AUTO_LOGIN_KEY, '1') } catch {}
}

export function clearExplicitLogout(): void {
  try { sessionStorage.removeItem(PI_SKIP_AUTO_LOGIN_KEY) } catch {}
}

export function shouldSkipPiAutoLogin(): boolean {
  try { return sessionStorage.getItem(PI_SKIP_AUTO_LOGIN_KEY) === '1' } catch { return false }
}

async function requestCookieAccess(): Promise<void> {
  if (typeof document === 'undefined') return
  if (document.requestStorageAccess) {
    try { await document.requestStorageAccess() } catch { /* ignore */ }
  }
}

async function waitForPiSdk(timeoutMs = 8000): Promise<void> {
  const started = Date.now()
  while (!window.Pi) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('PI_SDK_UNAVAILABLE')
    }
    await new Promise(r => setTimeout(r, 100))
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, code: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(code)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** await Pi.init fully before authenticate (username + payments scopes) */
export async function initPiSdk(forcedSandbox?: boolean): Promise<void> {
  await waitForPiSdk(15_000)
  const sandbox = forcedSandbox ?? await resolvePiSandbox()
  if (initSandbox === sandbox) return
  initSandbox = sandbox
  await Promise.resolve(window.Pi!.init({ version: '2.0', sandbox }))
}

export async function authenticateWithPi(): Promise<PiAuthResult> {
  try {
    await initPiSdk()
    return await withTimeout(
      Promise.resolve(window.Pi!.authenticate([...PI_AUTH_SCOPES], resolveIncompletePiPayment)),
      30_000,
      'PI_AUTH_TIMEOUT',
    )
  } catch (err) {
    if (err instanceof Error && err.message === 'PI_AUTH_TIMEOUT' && initSandbox === false) {
      initSandbox = null
      await initPiSdk(true)
      return window.Pi!.authenticate([...PI_AUTH_SCOPES], resolveIncompletePiPayment)
    }
    throw err
  }
}

async function exchangePiTokenForSession(accessToken: string): Promise<{ ok: boolean; error?: string }> {
  const result = await signIn('pi-network', {
    accessToken,
    redirect: false,
  })
  if (result?.error) {
    return { ok: false, error: 'فشل التحقق من حساب Pi. يرجى المحاولة مرة أخرى' }
  }
  return { ok: true }
}

/** Paths where we resume an existing session on load */
function isPiEntryPath(): boolean {
  if (typeof window === 'undefined') return false
  const p = window.location.pathname
  return (
    p === '/' ||
    p === '/login' ||
    p === '/register' ||
    p === '/pi.html' ||
    p === '/pi-login.html' ||
    p === '/pi-email.html'
  )
}

/** On load: redirect if session exists on entry pages only */
export async function runPiAuthOnLoad(): Promise<'redirecting' | 'idle'> {
  if (!isPiEntryPath()) return 'idle'
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
    const session = await res.json()
    if (session?.user) {
      if (typeof window !== 'undefined') window.location.href = '/dashboard'
      return 'redirecting'
    }
  } catch (err) {
    console.warn('[Pi Auth] runOnLoad', err)
  }
  return 'idle'
}

export async function signInWithPiNetwork(): Promise<{
  ok: boolean
  error?: string
}> {
  const ready = await isPiBrowserReady()
  if (!ready) {
    return { ok: false, error: 'Pi Browser غير متوفر. افتح التطبيق داخل Pi Browser' }
  }

  try {
    clearExplicitLogout()
    await requestCookieAccess()
    const authResult = await authenticateWithPi()
    await requestCookieAccess()
    return exchangePiTokenForSession(authResult.accessToken)
  } catch (err) {
    console.error('[Pi Auth]', err)
    return { ok: false, error: 'حدث خطأ أثناء التحقق من Pi Network' }
  }
}
