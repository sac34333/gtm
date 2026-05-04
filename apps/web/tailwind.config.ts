import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'glow-indigo':  '0 0 24px -4px rgba(99, 102, 241, 0.45)',
        'glow-violet':  '0 0 24px -4px rgba(139, 92, 246, 0.45)',
        'glow-fuchsia': '0 0 24px -4px rgba(217, 70, 239, 0.45)',
        'glow-emerald': '0 0 22px -4px rgba(16, 185, 129, 0.45)',
        'glow-cyan':    '0 0 22px -4px rgba(6, 182, 212, 0.45)',
        'glow-amber':   '0 0 22px -4px rgba(245, 158, 11, 0.45)',
        'glow-rose':    '0 0 22px -4px rgba(244, 63, 94, 0.45)',
        'glass':        '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.35)',
        'glass-lg':     '0 1px 0 rgba(255,255,255,0.06) inset, 0 16px 48px rgba(0,0,0,0.45)',
      },
      animation: {
        'shimmer':       'shimmer 2.4s linear infinite',
        'spin-slow':     'spin 8s linear infinite',
        'float':         'float 6s ease-in-out infinite',
        'pulse-glow':    'pulseGlow 2.4s ease-in-out infinite',
        'fade-in':       'fadeIn 0.4s ease-out both',
        'fade-up':       'fadeUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'gradient-pan':  'gradientPan 8s ease infinite',
        'pop-in':        'popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.65', boxShadow: '0 0 8px rgba(16,185,129,0.5)' },
          '50%':      { opacity: '1',    boxShadow: '0 0 18px rgba(16,185,129,0.8)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        gradientPan: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
        popIn: {
          '0%':   { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      backgroundImage: {
        'shimmer-line': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
        'grid-faint':   'linear-gradient(to right, rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.06) 1px, transparent 1px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config

