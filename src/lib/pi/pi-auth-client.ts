'use client'

import { signIn } from 'next-auth/react'

const PI_SCOPES = ['username'] as const
export const PI_SKIP_AUTO_LOGIN_KEY = 'pi_skip_auto_login'

function onIncompletePaymentFound(payment: unknown): void {
  console.warn('[Pi] Incomplete payment found:', payment)
}

/** Pi SDK is loaded on every page; require Pi Browser UA — not just window.Pi */
export function isPiBrowser(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.Pi === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return /pibrowser|pi browser|pinetwork/.test(ua)
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

/** await Pi.init fully (Promise or sync) before authenticate */
export async function initPiSdk(): Promise<void> {
  if (!window.Pi) {
    throw new Error('PI_SDK_UNAVAILABLE')
  }

  const initConfig: { version: string; sandbox?: boolean } = {
    version: '2.0',
    sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === 'true',
  }

  const initResult = window.Pi.init(initConfig)
  await Promise.resolve(initResult)
}

export async function authenticateWithPi(): Promise<PiAuthResult> {
  await initPiSdk()
  return window.Pi!.authenticate([...PI_SCOPES], onIncompletePaymentFound)
}

export async function signInWithPiNetwork(): Promise<{
  ok: boolean
  error?: string
}> {
  if (!isPiBrowser()) {
    return { ok: false, error: 'Pi Browser غير متوفر. افتح التطبيق داخل Pi Browser' }
  }

  try {
    const authResult = await authenticateWithPi()

    const result = await signIn('pi-network', {
      accessToken: authResult.accessToken,
      redirect:    false,
    })

    if (result?.error) {
      return { ok: false, error: 'فشل التحقق من حساب Pi. يرجى المحاولة مرة أخرى' }
    }

    return { ok: true }
  } catch (err) {
    console.error('[Pi Auth]', err)
    return { ok: false, error: 'حدث خطأ أثناء التحقق من Pi Network' }
  }
}
