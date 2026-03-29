'use client'
// src/components/auth/PiLoginButton.tsx
// Pi Network authentication button
// Requires Pi SDK to be loaded via script tag in layout

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface PiLoginButtonProps {
  callbackUrl?: string
  onSuccess?: () => void
  onError?: (error: string) => void
}

// Pi SDK types
declare global {
  interface Window {
    Pi?: {
      init: (config: { version: string; sandbox?: boolean }) => void
      authenticate: (
        scopes: string[],
        onIncompletePaymentFound: (payment: unknown) => void
      ) => Promise<{ accessToken: string; user: { uid: string; username: string } }>
    }
  }
}

export default function PiLoginButton({ callbackUrl = '/dashboard', onSuccess, onError }: PiLoginButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePiLogin() {
    if (!window.Pi) {
      const msg = 'Pi Browser غير متوفر. يرجى فتح التطبيق داخل Pi Browser'
      setError(msg)
      onError?.(msg)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Initialize Pi SDK
      window.Pi.init({
        version: '2.0',
        sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === 'true',
      })

      // Authenticate with Pi
      const authResult = await window.Pi.authenticate(
        ['username', 'payments', 'wallet_address'],
        (payment) => {
          // Handle incomplete payments
          console.warn('[Pi] Incomplete payment found:', payment)
        }
      )

      // Send token to our backend via NextAuth
      const result = await signIn('pi-network', {
        accessToken: authResult.accessToken,
        redirect: false,
      })

      if (result?.error) {
        const msg = 'فشل التحقق من حساب Pi. يرجى المحاولة مرة أخرى'
        setError(msg)
        onError?.(msg)
        return
      }

      onSuccess?.()
      router.push(callbackUrl)
      router.refresh()
    } catch (err) {
      const msg = 'حدث خطأ أثناء التحقق من Pi Network'
      setError(msg)
      onError?.(msg)
      console.error('[Pi Auth Error]', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handlePiLogin}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 bg-[#6B21A8]/20 hover:bg-[#6B21A8]/30 border border-[#a855f7]/30 hover:border-[#a855f7]/50 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 text-sm group"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-purple-300">جاري التحقق من Pi...</span>
          </>
        ) : (
          <>
            {/* Pi Logo */}
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <span className="text-white text-xs font-bold">π</span>
            </div>
            <span className="text-slate-200">تسجيل الدخول بـ Pi Network</span>
          </>
        )}
      </button>

      {error && (
        <p className="text-center text-red-400 text-xs">{error}</p>
      )}

      <p className="text-center text-slate-500 text-xs">
        يتطلب Pi Browser مثبتاً على جهازك
      </p>
    </div>
  )
}
