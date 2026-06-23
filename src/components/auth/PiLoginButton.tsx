'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithPiNetwork, clearExplicitLogout } from '@/lib/pi/pi-auth-client'

interface PiLoginButtonProps {
  callbackUrl?: string
  onSuccess?: () => void
  onError?: (error: string) => void
  compact?: boolean
  disabled?: boolean
}

export default function PiLoginButton({
  callbackUrl = '/dashboard',
  onSuccess,
  onError,
  compact = false,
  disabled = false,
}: PiLoginButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePiLogin() {
    setIsLoading(true)
    setError('')

    const result = await signInWithPiNetwork()

    setIsLoading(false)

    if (!result.ok) {
      setError(result.error ?? 'فشل تسجيل الدخول')
      onError?.(result.error ?? 'فشل تسجيل الدخول')
      return
    }

    clearExplicitLogout()
    onSuccess?.()
    router.push(callbackUrl)
    router.refresh()
  }

  if (compact) {
    return (
      <div>
        <button
          type="button"
          onClick={handlePiLogin}
          disabled={isLoading || disabled}
          className="w-full flex items-center justify-center gap-2 bg-[#6B21A8]/30 hover:bg-[#6B21A8]/40 border border-[#a855f7]/30 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-xl transition-all text-sm"
        >
          {isLoading ? 'جاري التحقق...' : 'π Pi Network'}
        </button>
        {error && <p className="pi-auth-error">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={handlePiLogin}
        disabled={isLoading || disabled}
        className="pi-auth-btn pi-auth-btn-pi"
      >
        {isLoading ? (
          <>
            <span className="pi-auth-spinner" /> جاري التحقق من Pi...
          </>
        ) : (
          <>🟣 تسجيل الدخول بـ Pi Network</>
        )}
      </button>
      {error && <p className="pi-auth-error">{error}</p>}
    </div>
  )
}
