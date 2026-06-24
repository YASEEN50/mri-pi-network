'use client'

import { useTranslations } from 'next-intl'
import { usePiPushNotifications } from '@/hooks/usePiPushNotifications'

/** Pi Browser: prompt for Web Notification permission + background polling */
export function PiPushProvider() {
  const t = useTranslations('notifications')
  const { inPi, permission, pushEnabled, canPrompt, requestPermission, disablePush } =
    usePiPushNotifications()

  if (!inPi || permission === 'unsupported') return null

  if (permission === 'denied') return null

  if (canPrompt) {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md rounded-xl border border-teal-500/30 bg-slate-900/95 p-4 shadow-lg backdrop-blur sm:left-auto sm:right-4"
      >
        <p className="text-sm font-medium text-slate-100">{t('push_enable_title')}</p>
        <p className="mt-1 text-xs text-slate-400">{t('push_enable_body')}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void requestPermission()}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500"
          >
            {t('push_enable_button')}
          </button>
          <button
            type="button"
            onClick={disablePush}
            className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            {t('push_dismiss')}
          </button>
        </div>
      </div>
    )
  }

  if (permission === 'granted' && pushEnabled) return null

  return null
}
