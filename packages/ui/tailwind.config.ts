import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

type OpacityContext = { opacityValue?: string };

/**
 * A theme colour backed by a CSS custom property. Tailwind cannot apply an
 * opacity modifier (`bg-healthy/10`, `border-warn/40`, `text-foreground/90`) to a
 * bare `var(--x)`, which silently dropped those classes from the stylesheet. The
 * tokens are full colour values (OKLCH or hex), so the modifier is expressed with
 * `color-mix`, which keeps the unmodified form a plain `var()`.
 */
const token =
  (name: string) =>
  ({ opacityValue }: OpacityContext): string =>
    opacityValue === undefined || opacityValue === '1' || opacityValue.startsWith('var(--tw-')
      ? `var(--${name})`
      : `color-mix(in srgb, var(--${name}) calc(${opacityValue} * 100%), transparent)`;

/**
 * Component-layer utilities from globals.css that apps use by class name. Tailwind
 * only emits an `@layer components` rule when its class appears in `content`, and
 * a library build scans only its own sources, so consumers' use of these classes
 * (the dashboard shell uses "cli-chip", "label-eyebrow", ...) must be safelisted.
 */
const componentClasses = [
  'surface',
  'surface-raised',
  'surface-pop',
  'hairline',
  'label-eyebrow',
  'cli-chip',
  'status-badge',
  'status-healthy',
  'status-warn',
  'status-critical',
  'status-info',
  're-shell-grid',
  're-shell-mono',
  'skeleton',
  'stagger-children',
  'screen-enter'
];

const config: Config = {
  safelist: componentClasses,
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
        border: token('border'),
        'border-strong': token('border-strong'),
        input: token('input'),
        control: token('control'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        'bg-0': token('bg-0'),
        'bg-1': token('bg-1'),
        'bg-2': token('bg-2'),
        'bg-3': token('bg-3'),
        primary: {
          DEFAULT: token('primary'),
          foreground: token('primary-foreground')
        },
        signal: {
          DEFAULT: token('signal'),
          foreground: token('signal-foreground'),
          glow: token('signal-glow')
        },
        secondary: {
          DEFAULT: token('secondary'),
          foreground: token('secondary-foreground')
        },
        destructive: {
          DEFAULT: token('destructive'),
          foreground: token('destructive-foreground')
        },
        muted: {
          DEFAULT: token('muted'),
          foreground: token('muted-foreground')
        },
        accent: {
          DEFAULT: token('accent'),
          foreground: token('accent-foreground')
        },
        popover: {
          DEFAULT: token('popover'),
          foreground: token('popover-foreground')
        },
        card: {
          DEFAULT: token('card'),
          foreground: token('card-foreground')
        },
        healthy: {
          DEFAULT: token('status-healthy'),
          foreground: token('status-healthy-foreground'),
          glow: token('status-healthy-glow')
        },
        warn: {
          DEFAULT: token('status-warn'),
          foreground: token('status-warn-foreground'),
          glow: token('status-warn-glow')
        },
        critical: {
          DEFAULT: token('status-critical'),
          foreground: token('status-critical-foreground'),
          glow: token('status-critical-glow')
        },
        info: {
          DEFAULT: token('status-info'),
          foreground: token('status-info-foreground'),
          glow: token('status-info-glow')
        }
      },
      fontFamily: {
        // Stacks live in CSS variables so a theme pack can swap them at runtime.
        display: ['var(--font-display)', '"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
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
