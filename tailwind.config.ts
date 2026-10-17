import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        primary: {
          DEFAULT: '#16a34a',
          foreground: '#ffffff'
        },
        secondary: {
          DEFAULT: '#0284c7',
          foreground: '#ffffff'
        },
        danger: {
          DEFAULT: '#dc2626',
          foreground: '#ffffff'
        },
        warning: {
          DEFAULT: '#d97706',
          foreground: '#ffffff'
        },
        success: {
          DEFAULT: '#059669',
          foreground: '#ffffff'
        },
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a'
        }
      }
    }
  },
  plugins: [tailwindcssAnimate]
}

export default config
