import type { Config } from 'tailwindcss'

/**
 * Zyro Chat design tokens.
 * Raw values live as CSS variables in src/index.css (single source of truth);
 * Tailwind maps them to utilities so `bg-brand-500/20` etc. work with opacity.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1.25rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1200px' },
    },
    extend: {
      colors: {
        // Primary — "Zyro Blue", an electric indigo-leaning blue
        brand: {
          50: token('brand-50'),
          100: token('brand-100'),
          200: token('brand-200'),
          300: token('brand-300'),
          400: token('brand-400'),
          500: token('brand-500'),
          600: token('brand-600'),
          700: token('brand-700'),
          800: token('brand-800'),
          900: token('brand-900'),
        },
        // Accent — "Ion Cyan", used for gradients, highlights and live states
        ion: {
          100: token('ion-100'),
          300: token('ion-300'),
          400: token('ion-400'),
          500: token('ion-500'),
          600: token('ion-600'),
        },
        // Neutrals — cool-tinted ink scale
        ink: {
          0: token('ink-0'),
          25: token('ink-25'),
          50: token('ink-50'),
          100: token('ink-100'),
          200: token('ink-200'),
          300: token('ink-300'),
          400: token('ink-400'),
          500: token('ink-500'),
          600: token('ink-600'),
          700: token('ink-700'),
          800: token('ink-800'),
          900: token('ink-900'),
          950: token('ink-950'),
        },
        success: token('success'),
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Inter Variable"', 'system-ui', 'sans-serif'],
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // Fluid type scale (major third, clamped for mobile → desktop)
      fontSize: {
        'display-xl': ['clamp(2.75rem, 1.6rem + 4.6vw, 5.25rem)', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(2.25rem, 1.5rem + 3vw, 3.75rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(1.75rem, 1.35rem + 1.6vw, 2.5rem)', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
        'display-sm': ['clamp(1.375rem, 1.2rem + 0.7vw, 1.75rem)', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        'body-lg': ['1.1875rem', { lineHeight: '1.6' }],
        'body-md': ['1rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.55' }],
        caption: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.02em' }],
      },
      spacing: {
        section: 'clamp(4.5rem, 3rem + 4.5vw, 7rem)',
        18: '4.5rem',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        // Layered, blue-tinted elevation
        card: '0 1px 2px rgb(var(--ink-900) / 0.04), 0 4px 16px -4px rgb(var(--ink-900) / 0.06)',
        lift: '0 2px 4px rgb(var(--ink-900) / 0.04), 0 24px 48px -16px rgb(var(--brand-600) / 0.22)',
        glow: '0 0 0 1px rgb(var(--brand-500) / 0.35), 0 8px 32px -6px rgb(var(--brand-500) / 0.45)',
        window: '0 0 0 1px rgb(var(--ink-900) / 0.06), 0 40px 80px -24px rgb(var(--brand-800) / 0.28), 0 12px 24px -12px rgb(var(--ink-900) / 0.12)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(120deg, rgb(var(--brand-600)) 0%, rgb(var(--brand-500)) 45%, rgb(var(--ion-500)) 100%)',
        'grid-faint':
          'linear-gradient(rgb(var(--ink-900) / 0.045) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--ink-900) / 0.045) 1px, transparent 1px)',
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'pulse-dot': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
        drift: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(4%, -6%, 0) scale(1.08)' },
        },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
        drift: 'drift 18s ease-in-out infinite',
        shimmer: 'shimmer 6s linear infinite',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config
