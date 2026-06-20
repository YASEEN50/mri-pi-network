'use client'

import { signIn } from 'next-auth/react'

const PI_SCOPES = ['username'] as const

function onIncompletePaymentFound(payment: unknown): void {
  console.warn('[Pi] Incomplete payment found:', payment)
}

export function isPiBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.Pi !== 'undefined'
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
