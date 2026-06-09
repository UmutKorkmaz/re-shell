import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        'bg-0': 'var(--bg-0)',
        'bg-1': 'var(--bg-1)',
        'bg-2': 'var(--bg-2)',
        'bg-3': 'var(--bg-3)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)'
        },
        signal: {
          DEFAULT: 'var(--signal)',
          foreground: 'var(--signal-foreground)',
          glow: 'var(--signal-glow)'
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)'
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)'
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)'
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)'
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)'
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)'
        },
        healthy: {
          DEFAULT: 'var(--status-healthy)',
          foreground: 'var(--status-healthy-foreground)',
          glow: 'var(--status-healthy-glow)'
        },
        warn: {
          DEFAULT: 'var(--status-warn)',
          foreground: 'var(--status-warn-foreground)',
          glow: 'var(--status-warn-glow)'
        },
        critical: {
          DEFAULT: 'var(--status-critical)',
          foreground: 'var(--status-critical-foreground)',
          glow: 'var(--status-critical-glow)'
        },
        info: {
          DEFAULT: 'var(--status-info)',
          foreground: 'var(--status-info-foreground)',
          glow: 'var(--status-info-glow)'
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 3px)',
        sm: 'calc(var(--radius) - 5px)'
      },
      boxShadow: {
        'elev-1': '0 1px 2px 0 rgb(0 0 0 / 0.30), inset 0 1px 0 0 var(--hairline-top)',
        'elev-2': '0 4px 12px -2px rgb(0 0 0 / 0.40), inset 0 1px 0 0 var(--hairline-top)',
        'elev-3': '0 12px 32px -6px rgb(0 0 0 / 0.55), inset 0 1px 0 0 var(--hairline-top)',
        'glow-signal': '0 0 0 1px var(--signal), 0 0 18px -2px var(--signal-glow)',
        'glow-healthy': '0 0 14px -2px var(--status-healthy-glow)',
        'glow-warn': '0 0 14px -2px var(--status-warn-glow)',
        'glow-critical': '0 0 16px -2px var(--status-critical-glow)',
        'glow-info': '0 0 14px -2px var(--status-info-glow)',
        'focus-ring': '0 0 0 2px var(--background), 0 0 0 4px var(--ring)'
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16,1,0.3,1)',
        standard: 'cubic-bezier(0.2,0,0,1)'
      },
      transitionDuration: {
        fast: '120ms',
        normal: '200ms',
        slow: '360ms'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'pulse-live': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.45' }
        },
        'stagger-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'log-flash': {
          from: { backgroundColor: 'var(--signal-glow)' },
          to: { backgroundColor: 'transparent' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 200ms ease-out',
        'accordion-up': 'accordion-up 200ms ease-out',
        'pulse-live': 'pulse-live 1.6s ease-in-out infinite',
        'stagger-in': 'stagger-in 360ms var(--ease-out-expo) both',
        'log-flash': 'log-flash 700ms ease-out',
        shimmer: 'shimmer 1.8s linear infinite',
        'fade-in': 'fade-in 300ms var(--ease-out-expo) both'
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
