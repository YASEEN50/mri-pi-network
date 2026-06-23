'use client'

import { signIn } from 'next-auth/react'

const PI_SCOPES = ['username'] as const
export const PI_SKIP_AUTO_LOGIN_KEY = 'pi_skip_auto_login'

function onIncompletePaymentFound(payment: unknown): void {
  console.warn('[Pi] Incomplete payment found:', payment)
}

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
  if (!isPiBrowser()) return false
  try {
    await waitForPiSdk(timeoutMs)
    return typeof window.Pi !== 'undefined'
  } catch {
    return false
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

/** await Pi.init fully before authenticate (username scope) */
export async function initPiSdk(): Promise<void> {
  await waitForPiSdk()
  await window.Pi!.init({
    version: '2.0',
    sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === 'true',
  })
}

export async function authenticateWithPi(): Promise<PiAuthResult> {
  await initPiSdk()
  return window.Pi!.authenticate([...PI_SCOPES], onIncompletePaymentFound)
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

export async function signInWithPiNetwork(): Promise<{
  ok: boolean
  error?: string
}> {
  const ready = await isPiBrowserReady()
  if (!ready) {
    return { ok: false, error: 'Pi Browser غير متوفر. افتح التطبيق داخل Pi Browser' }
  }

  try {
    await requestCookieAccess()
    const authResult = await authenticateWithPi()
    await requestCookieAccess()
    return exchangePiTokenForSession(authResult.accessToken)
  } catch (err) {
    console.error('[Pi Auth]', err)
    return { ok: false, error: 'حدث خطأ أثناء التحقق من Pi Network' }
  }
}
