// src/app/(auth)/layout.tsx
import Script from 'next/script'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Pi Network SDK */}
      <Script
        src="https://sdk.minepi.com/pi-sdk.js"
        strategy="beforeInteractive"
      />
      {children}
    </>
  )
}
