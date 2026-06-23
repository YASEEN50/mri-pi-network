'use client'

import Script from 'next/script'

/** Load Pi SDK early — needed for payments in Pi WebView iframe */
export function PiSdkScript() {
  return (
    <Script
      src="https://sdk.minepi.com/pi-sdk.js"
      strategy="beforeInteractive"
    />
  )
}
