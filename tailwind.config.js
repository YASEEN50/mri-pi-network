/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-cairo)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#0A66C2',
          50:  '#EFF6FF',
          100: '#DBEAFE',
          400: '#3B82F6',
          500: '#0A66C2',
          600: '#0854A0',
          700: '#064787',
          900: '#1A365D',
        },
        secondary: {
          DEFAULT: '#1A365D',
          light: '#243B53',
        },
        accent: {
          DEFAULT: '#00D4FF',
          dim: '#00B8DB',
        },
        surface: {
          DEFAULT: '#111827',
          elevated: '#1A2332',
          card: 'rgba(255,255,255,0.03)',
        },
        background: {
          DEFAULT: '#0A0F1E',
          deep: '#060912',
        },
        success: { DEFAULT: '#22C55E', dim: '#16A34A' },
        warning: { DEFAULT: '#F59E0B', dim: '#D97706' },
        danger:  { DEFAULT: '#EF4444', dim: '#DC2626' },
        /* legacy alias — maps old emerald usage to primary */
        brand: {
          400: '#00D4FF',
          500: '#0A66C2',
          600: '#0854A0',
        },
      },
      boxShadow: {
        card: '0 4px 24px rgba(10, 102, 194, 0.08)',
        'card-hover': '0 8px 32px rgba(10, 102, 194, 0.18)',
        glow: '0 0 40px rgba(0, 212, 255, 0.15)',
        'glow-primary': '0 0 30px rgba(10, 102, 194, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(12px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
