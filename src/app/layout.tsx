// src/app/layout.tsx
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { SessionProvider } from '@/components/common/SessionProvider'
import { PiAuthProvider } from '@/components/auth/PiAuthProvider'
import { PiSdkScript } from '@/components/auth/PiSdkScript'
import { PI_BROWSER_REDIRECT_SCRIPT } from '@/lib/pi/pi-browser-redirect-script'
import './globals.css'

import { Cairo, Inter } from 'next/font/google'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'MRI', template: '%s | MRI' },
  description: 'MRI — منصة طبية موثوقة تربط المرضى بالأطباء والمنشآت المعتمدة',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  const isRTL = locale === 'ar'

  return (
    <html lang={locale} dir={isRTL ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PI_BROWSER_REDIRECT_SCRIPT }} />
      </head>
      <body
        suppressHydrationWarning
        className={`${cairo.variable} ${inter.variable} font-sans bg-background text-slate-100 antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <SessionProvider>
            <PiAuthProvider>
              {children}
            </PiAuthProvider>
          </SessionProvider>
        </NextIntlClientProvider>
        <PiSdkScript />
      </body>
    </html>
  )
}
