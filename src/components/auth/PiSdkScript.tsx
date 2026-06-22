'use client'

import Script from 'next/script'

/** Load Pi SDK after the page paints — avoids blocking Pi Browser WebView on first paint. */
export function PiSdkScript() {
  return (
    <Script
      src="https://sdk.minepi.com/pi-sdk.js"
      strategy="afterInteractive"
    />
  )
}
