/** @type {import('next').NextConfig} */
const nextConfig = {
  // i18n handled by next-intl (no built-in i18n needed)
  outputFileTracingRoot: require('path').join(__dirname),

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.cloudflare.com' },
      { protocol: 'http',  hostname: 'localhost' },
    ],
  },

  // Allow Pi SDK domain
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'SAMEORIGIN' }, // Pi SDK يحتاج SAMEORIGIN
          { key: 'X-XSS-Protection',       value: '1; mode=block' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },

  // Pi Browser: lightweight static entry (Next.js bundle is heavy in Pi WebView)
  async redirects() {
    const piUa = '(?i).*(pibrowser|pi browser|pinetwork|minepi).*'
    return [
      {
        source: '/',
        has: [{ type: 'header', key: 'user-agent', value: piUa }],
        destination: '/pi.html',
        permanent: false,
      },
      {
        source: '/login',
        has: [{ type: 'header', key: 'user-agent', value: piUa }],
        destination: '/pi-login.html',
        permanent: false,
      },
    ]
  },

  // التوجيه حسب الدور يتم في src/app/dashboard/page.tsx
}

const withNextIntl = require('next-intl/plugin')('./src/i18n/config.ts')
module.exports = withNextIntl(nextConfig)
