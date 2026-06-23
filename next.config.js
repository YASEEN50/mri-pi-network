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

  // Security headers — skip static Pi entry files (Pi WebView can be sensitive to these)
  async headers() {
    const piHeaders = [
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://minepi.com https://*.minepi.com https://sandbox.minepi.com https://*.pi.network" },
    ]
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // No X-Frame-Options — Pi Browser loads apps inside sandbox.minepi.com iframe
      { key: 'X-XSS-Protection',       value: '1; mode=block' },
      { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ]
    return [
      { source: '/', headers: piHeaders },
      { source: '/login', headers: piHeaders },
      { source: '/register', headers: piHeaders },
      { source: '/pi.html', headers: piHeaders },
      { source: '/pi-login.html', headers: piHeaders },
      { source: '/pi-email.html', headers: piHeaders },
      { source: '/pi-register.html', headers: piHeaders },
      { source: '/pi-app.html', headers: piHeaders },
      { source: '/pi-profile.html', headers: piHeaders },
      { source: '/pi-dashboard.html', headers: piHeaders },
      { source: '/pi-appointments.html', headers: piHeaders },
      { source: '/pi-doctors.html', headers: piHeaders },
      { source: '/pi-doctor.html', headers: piHeaders },
      { source: '/pi-owner.html', headers: piHeaders },
      { source: '/pi-select-role.html', headers: piHeaders },
      { source: '/pi-shell.js', headers: piHeaders },
      { source: '/pi-shell.css', headers: piHeaders },
      {
        source: '/((?!pi\\.html|pi-login\\.html|pi-email\\.html|pi-register\\.html|pi-app\\.html|pi-profile\\.html|pi-dashboard\\.html|pi-appointments\\.html|pi-doctors\\.html|pi-doctor\\.html|pi-owner\\.html|pi-select-role\\.html|pi-shell\\.js|pi-shell\\.css|test-pi\\.txt).*)',
        headers: securityHeaders,
      },
    ]
  },

  // Pi Browser: serve static HTML at root URL (Pi Portal disallows paths in App URL)
  async redirects() {
    return [
      { source: '/privacypolicy', destination: '/privacy', permanent: true },
      { source: '/terms-of-service', destination: '/terms', permanent: true },
    ]
  },

  // التوجيه حسب الدور يتم في src/app/dashboard/page.tsx
}

const withNextIntl = require('next-intl/plugin')('./src/i18n/config.ts')
module.exports = withNextIntl(nextConfig)
