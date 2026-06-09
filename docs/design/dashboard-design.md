# Re-Shell Dashboard — Design System Spec

> **Direction:** _Dark mission-control_ — a premium developer control surface in the lineage of
> Vercel, Linear, and Grafana. Dark-first, layered near-black elevations, ONE electric signal
> accent used semantically, distinct status colors, grotesk + mono typography with strong scale
> contrast, hairline borders, soft depth, and restrained motion.

**Signal accent chosen:** **Electric Lime / Chartreuse — token name `signal`** (OKLCH `0.86 0.21 130`, hex `#c4f042`).
One accent only. Used for: primary actions, active nav, selected/focus rings, key data highlights, and the live/streaming pulse. Never decorative, never rainbowed.

**Fonts chosen:**
- **Display / headings & labels:** Space Grotesk → `@fontsource/space-grotesk`
- **Data / commands / logs / metrics / paths:** JetBrains Mono → `@fontsource/jetbrains-mono`
- **Body / UI copy:** Inter → `@fontsource/inter`

All self-hosted via `@fontsource` (offline; NO Google Fonts CDN).

---

## 0. Implementation Notes (read first)

- The shadcn vars today are **HSL triplets** consumed as `hsl(var(--x))` in `packages/ui/tailwind.config.ts`.
  This spec migrates the color system to **raw color values** consumed directly (e.g. `var(--background)`),
  using OKLCH with a hex fallback. When implementing, switch the Tailwind `colors` mapping from
  `hsl(var(--x))` to `var(--x)` and provide the `@supports not (color: oklch(...))` hex fallback block.
- Custom tokens (`--bg-0..3`, `--status-*`, shadows) are NEW and additive.
- Theme switch: `.dark` class on `<html>` (already wired). Light is the companion theme; dark is the default.
- All values below are copy-pasteable.

---

## 1. Color Tokens

### 1.1 Dark theme (default) — `:root` / `.dark`

```css
.dark,
:root {
  color-scheme: dark;

  /* ---- Elevation stack (near-black, each step +lightness) ---- */
  --bg-0: oklch(0.16 0.012 265);   /* #0c0e12  base canvas            */
  --bg-1: oklch(0.19 0.013 265);   /* #14171d  panel / card           */
  --bg-2: oklch(0.23 0.014 265);   /* #1c2028  raised / hover         */
  --bg-3: oklch(0.27 0.015 265);   /* #262b35  popover / overlay      */

  /* ---- shadcn surface roles (map onto the stack) ---- */
  --background:         oklch(0.16 0.012 265);   /* #0c0e12 = bg-0 */
  --foreground:         oklch(0.96 0.006 265);   /* #f0f1f4        */
  --card:               oklch(0.19 0.013 265);   /* #14171d = bg-1 */
  --card-foreground:    oklch(0.96 0.006 265);   /* #f0f1f4        */
  --popover:            oklch(0.23 0.014 265);   /* #1c2028 = bg-2 */
  --popover-foreground: oklch(0.96 0.006 265);   /* #f0f1f4        */

  --muted:              oklch(0.23 0.014 265);   /* #1c2028        */
  --muted-foreground:   oklch(0.66 0.012 265);   /* #9aa0ab        */

  --secondary:          oklch(0.23 0.014 265);   /* #1c2028        */
  --secondary-foreground: oklch(0.96 0.006 265); /* #f0f1f4        */

  /* ---- Signal accent (the ONE accent) ---- */
  --signal:             oklch(0.86 0.21 130);    /* #c4f042 lime   */
  --signal-foreground:  oklch(0.18 0.04 130);    /* #14180a ink on lime */
  --signal-glow:        oklch(0.86 0.21 130 / 0.35);

  /* primary == signal so shadcn Buttons use the accent */
  --primary:            oklch(0.86 0.21 130);    /* #c4f042        */
  --primary-foreground: oklch(0.18 0.04 130);    /* #14180a        */

  /* accent role (subtle tinted hover surface, NOT the signal) */
  --accent:             oklch(0.24 0.02 130);    /* #1f240f muted lime tint */
  --accent-foreground:  oklch(0.92 0.12 130);    /* #dbe9a0        */

  /* ---- Lines & fields ---- */
  --border:             oklch(0.30 0.012 265 / 0.55);  /* hairline, low-alpha #353a44@55 */
  --border-strong:      oklch(0.40 0.014 265 / 0.70);
  --input:              oklch(0.27 0.014 265);   /* #262b35 = bg-3 */
  --ring:               oklch(0.86 0.21 130);    /* signal focus ring */

  /* ---- Status colors + foreground + glow ---- */
  --status-healthy:            oklch(0.80 0.17 150);   /* #5fd49a emerald */
  --status-healthy-foreground: oklch(0.18 0.04 150);   /* #0a160f */
  --status-healthy-glow:       oklch(0.80 0.17 150 / 0.30);

  --status-warn:               oklch(0.83 0.16 85);    /* #f0c64a amber */
  --status-warn-foreground:    oklch(0.20 0.05 85);    /* #1a1404 */
  --status-warn-glow:          oklch(0.83 0.16 85 / 0.30);

  --status-critical:            oklch(0.66 0.21 25);    /* #f0584e red */
  --status-critical-foreground: oklch(0.97 0.01 25);    /* #fdeceb */
  --status-critical-glow:       oklch(0.66 0.21 25 / 0.32);

  --status-info:               oklch(0.75 0.13 235);   /* #5fb6ec cyan-blue */
  --status-info-foreground:    oklch(0.18 0.04 235);   /* #08151f */
  --status-info-glow:          oklch(0.75 0.13 235 / 0.30);

  /* destructive == critical for shadcn */
  --destructive:            oklch(0.66 0.21 25);   /* #f0584e */
  --destructive-foreground: oklch(0.97 0.01 25);   /* #fdeceb */

  /* inner-highlight color used in elevation shadows */
  --hairline-top: oklch(1 0 0 / 0.06);
}
```

### 1.2 Light theme (companion) — `:root` (default doc) / `.light`

A refined, high-contrast workstation light — cool paper, ink text, the SAME lime signal slightly
darkened for AA contrast on light surfaces. Not pastel, not soft.

```css
:root,
.light {
  color-scheme: light;

  --bg-0: oklch(0.97 0.004 265);   /* #f4f5f7  base       */
  --bg-1: oklch(0.99 0.002 265);   /* #fbfbfc  panel      */
  --bg-2: oklch(1.00 0.000 265);   /* #ffffff  raised     */
  --bg-3: oklch(1.00 0.000 265);   /* #ffffff  popover    */

  --background:         oklch(0.97 0.004 265);   /* #f4f5f7 */
  --foreground:         oklch(0.21 0.015 265);   /* #1d2129 */
  --card:               oklch(0.99 0.002 265);   /* #fbfbfc */
  --card-foreground:    oklch(0.21 0.015 265);   /* #1d2129 */
  --popover:            oklch(1.00 0.000 265);   /* #ffffff */
  --popover-foreground: oklch(0.21 0.015 265);   /* #1d2129 */

  --muted:              oklch(0.95 0.005 265);   /* #eceef1 */
  --muted-foreground:   oklch(0.46 0.012 265);   /* #646b76 */

  --secondary:          oklch(0.95 0.005 265);   /* #eceef1 */
  --secondary-foreground: oklch(0.21 0.015 265); /* #1d2129 */

  --signal:             oklch(0.74 0.18 130);    /* #8fb834 darker lime for AA */
  --signal-foreground:  oklch(0.18 0.04 130);    /* #14180a */
  --signal-glow:        oklch(0.74 0.18 130 / 0.28);

  --primary:            oklch(0.74 0.18 130);    /* #8fb834 */
  --primary-foreground: oklch(0.16 0.03 130);    /* #11140a */

  --accent:             oklch(0.94 0.05 130);    /* #e9f2cf lime tint surface */
  --accent-foreground:  oklch(0.35 0.10 130);    /* #4d5e1f */

  --border:             oklch(0.86 0.008 265 / 0.90);  /* #d4d7dd */
  --border-strong:      oklch(0.78 0.010 265);
  --input:              oklch(0.90 0.006 265);   /* #e1e3e8 */
  --ring:               oklch(0.74 0.18 130);

  --status-healthy:            oklch(0.62 0.16 150);   /* #2f9e6a */
  --status-healthy-foreground: oklch(0.99 0.01 150);
  --status-healthy-glow:       oklch(0.62 0.16 150 / 0.22);

  --status-warn:               oklch(0.70 0.15 75);    /* #c98a16 */
  --status-warn-foreground:    oklch(0.99 0.01 75);
  --status-warn-glow:          oklch(0.70 0.15 75 / 0.22);

  --status-critical:            oklch(0.55 0.21 25);   /* #d23b32 */
  --status-critical-foreground: oklch(0.99 0.01 25);
  --status-critical-glow:       oklch(0.55 0.21 25 / 0.22);

  --status-info:               oklch(0.58 0.15 235);   /* #2b82c4 */
  --status-info-foreground:    oklch(0.99 0.01 235);
  --status-info-glow:          oklch(0.58 0.15 235 / 0.22);

  --destructive:            oklch(0.55 0.21 25);
  --destructive-foreground: oklch(0.99 0.01 25);

  --hairline-top: oklch(1 0 0 / 0.80);
}
```

### 1.3 Hex fallback block (for engines without OKLCH)

```css
@supports not (color: oklch(0 0 0)) {
  .dark, :root {
    --bg-0:#0c0e12; --bg-1:#14171d; --bg-2:#1c2028; --bg-3:#262b35;
    --background:#0c0e12; --foreground:#f0f1f4;
    --card:#14171d; --card-foreground:#f0f1f4;
    --popover:#1c2028; --popover-foreground:#f0f1f4;
    --muted:#1c2028; --muted-foreground:#9aa0ab;
    --secondary:#1c2028; --secondary-foreground:#f0f1f4;
    --signal:#c4f042; --signal-foreground:#14180a;
    --primary:#c4f042; --primary-foreground:#14180a;
    --accent:#1f240f; --accent-foreground:#dbe9a0;
    --border:rgba(53,58,68,.55); --input:#262b35; --ring:#c4f042;
    --status-healthy:#5fd49a; --status-warn:#f0c64a; --status-critical:#f0584e; --status-info:#5fb6ec;
    --destructive:#f0584e; --destructive-foreground:#fdeceb;
  }
  :root.light, .light {
    --bg-0:#f4f5f7; --bg-1:#fbfbfc; --bg-2:#ffffff; --bg-3:#ffffff;
    --background:#f4f5f7; --foreground:#1d2129;
    --card:#fbfbfc; --popover:#ffffff;
    --muted:#eceef1; --muted-foreground:#646b76;
    --signal:#8fb834; --primary:#8fb834; --primary-foreground:#11140a;
    --accent:#e9f2cf; --accent-foreground:#4d5e1f;
    --border:#d4d7dd; --input:#e1e3e8; --ring:#8fb834;
    --status-healthy:#2f9e6a; --status-warn:#c98a16; --status-critical:#d23b32; --status-info:#2b82c4;
    --destructive:#d23b32;
  }
}
```

### 1.4 Tailwind color mapping (extend)

```ts
// tailwind.config.ts → theme.extend.colors  (note: var() direct, NOT hsl(var()))
colors: {
  border: 'var(--border)',
  'border-strong': 'var(--border-strong)',
  input: 'var(--input)',
  ring: 'var(--ring)',
  background: 'var(--background)',
  foreground: 'var(--foreground)',
  'bg-0': 'var(--bg-0)', 'bg-1': 'var(--bg-1)', 'bg-2': 'var(--bg-2)', 'bg-3': 'var(--bg-3)',
  primary:   { DEFAULT: 'var(--primary)',   foreground: 'var(--primary-foreground)' },
  signal:    { DEFAULT: 'var(--signal)',    foreground: 'var(--signal-foreground)', glow: 'var(--signal-glow)' },
  secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
  muted:     { DEFAULT: 'var(--muted)',     foreground: 'var(--muted-foreground)' },
  accent:    { DEFAULT: 'var(--accent)',    foreground: 'var(--accent-foreground)' },
  popover:   { DEFAULT: 'var(--popover)',   foreground: 'var(--popover-foreground)' },
  card:      { DEFAULT: 'var(--card)',      foreground: 'var(--card-foreground)' },
  destructive:{ DEFAULT:'var(--destructive)',foreground:'var(--destructive-foreground)' },
  healthy:  { DEFAULT:'var(--status-healthy)',  foreground:'var(--status-healthy-foreground)',  glow:'var(--status-healthy-glow)' },
  warn:     { DEFAULT:'var(--status-warn)',     foreground:'var(--status-warn-foreground)',     glow:'var(--status-warn-glow)' },
  critical: { DEFAULT:'var(--status-critical)', foreground:'var(--status-critical-foreground)', glow:'var(--status-critical-glow)' },
  info:     { DEFAULT:'var(--status-info)',     foreground:'var(--status-info-foreground)',     glow:'var(--status-info-glow)' },
}
```

---

## 2. Typography

### 2.1 Packages to install

```bash
npx pnpm@9.15.9 add @fontsource/space-grotesk @fontsource/jetbrains-mono @fontsource/inter
```

Import the needed weights once in `packages/ui/src/styles/globals.css` (or the dashboard entry).
Self-hosted, offline-safe:

```css
/* body */
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
/* display / headings & labels */
@import '@fontsource/space-grotesk/500.css';
@import '@fontsource/space-grotesk/600.css';
@import '@fontsource/space-grotesk/700.css';
/* data / mono */
@import '@fontsource/jetbrains-mono/400.css';
@import '@fontsource/jetbrains-mono/500.css';
@import '@fontsource/jetbrains-mono/700.css';
```

### 2.2 Tailwind fontFamily mapping

```ts
// tailwind.config.ts → theme.extend.fontFamily
fontFamily: {
  display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
}
```

### 2.3 Type scale (sizes / weights / tracking)

| Role | Font | Size / line-height | Weight | Tracking | Tailwind recipe |
|------|------|--------------------|--------|----------|-----------------|
| **Hero / page title** | Space Grotesk | 30px / 36px (1.875rem) | 700 | -0.02em | `font-display text-3xl font-bold tracking-tight` |
| **Section title** | Space Grotesk | 20px / 28px | 600 | -0.01em | `font-display text-xl font-semibold tracking-tight` |
| **Card title** | Space Grotesk | 15px / 20px | 600 | -0.005em | `font-display text-[0.9375rem] font-semibold` |
| **Label-uppercase** | Space Grotesk | 11px / 14px | 600 | 0.08em, UPPERCASE | `font-display text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground` |
| **Body** | Inter | 14px / 20px | 400–500 | 0 | `font-sans text-sm` |
| **Body-small / caption** | Inter | 12px / 16px | 400 | 0 | `font-sans text-xs text-muted-foreground` |
| **Mono-data (metrics/paths)** | JetBrains Mono | 13px / 18px | 500 | -0.01em | `font-mono text-[0.8125rem] font-medium tracking-tight tabular-nums` |
| **Mono big-metric** | JetBrains Mono | 28px / 32px | 700 | -0.02em | `font-mono text-[1.75rem] font-bold tabular-nums` |
| **Code / log line** | JetBrains Mono | 12.5px / 18px | 400 | 0 | `font-mono text-[0.78rem] leading-[1.4]` |

All numeric displays use `tabular-nums` (add `font-variant-numeric: tabular-nums`).

---

## 3. Depth — Elevation, Shadows, Hairlines, Glow

The layered look = surface color from the elevation stack + a 1px low-alpha border + a top inner
highlight + a soft drop shadow. Glow is reserved for the signal accent and status states.

### 3.1 boxShadow tokens (tailwind extend)

```ts
// tailwind.config.ts → theme.extend.boxShadow
boxShadow: {
  // panel/card: subtle drop + inner top highlight (the "real depth")
  'elev-1': '0 1px 2px 0 rgb(0 0 0 / 0.30), inset 0 1px 0 0 var(--hairline-top)',
  'elev-2': '0 4px 12px -2px rgb(0 0 0 / 0.40), inset 0 1px 0 0 var(--hairline-top)',
  'elev-3': '0 12px 32px -6px rgb(0 0 0 / 0.55), inset 0 1px 0 0 var(--hairline-top)',
  // accent glow (focus / live / selected key data)
  'glow-signal':  '0 0 0 1px var(--signal), 0 0 18px -2px var(--signal-glow)',
  'glow-healthy': '0 0 14px -2px var(--status-healthy-glow)',
  'glow-warn':    '0 0 14px -2px var(--status-warn-glow)',
  'glow-critical':'0 0 16px -2px var(--status-critical-glow)',
  'glow-info':    '0 0 14px -2px var(--status-info-glow)',
  // focus ring
  'focus-ring': '0 0 0 2px var(--background), 0 0 0 4px var(--ring)',
}
```

### 3.2 Utility classes (`@layer components` in globals.css)

```css
@layer components {
  /* base panel */
  .surface     { @apply bg-card border border-border rounded-lg shadow-elev-1; }
  .surface-raised { @apply bg-bg-2 border border-border rounded-lg shadow-elev-2; }
  .surface-pop { @apply bg-popover border border-border-strong rounded-md shadow-elev-3; }

  /* hairline divider */
  .hairline { @apply border-t border-border; }

  /* uppercase tracked micro-label */
  .label-eyebrow { @apply font-display text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground; }

  /* terminal/CLI chip (copy affordance) */
  .cli-chip {
    @apply inline-flex items-center gap-2 rounded-md border border-border bg-bg-0
           px-2.5 py-1.5 font-mono text-[0.8125rem] text-foreground/90 shadow-elev-1;
  }
  .cli-chip:hover { @apply border-border-strong; }

  /* status badge base — variants add color */
  .status-badge {
    @apply inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5
           font-display text-[0.6875rem] font-semibold uppercase tracking-[0.06em];
  }
  .status-healthy  { @apply text-healthy  border-healthy/40  bg-healthy/10  shadow-glow-healthy; }
  .status-warn     { @apply text-warn     border-warn/40     bg-warn/10     shadow-glow-warn; }
  .status-critical { @apply text-critical border-critical/40 bg-critical/10 shadow-glow-critical; }
  .status-info     { @apply text-info     border-info/40     bg-info/10     shadow-glow-info; }
}
```

---

## 4. Radius, Spacing Rhythm, Motion

### 4.1 Radius

```css
--radius: 0.625rem; /* 10px — slightly tighter than default for a tooling feel */
```
```ts
// borderRadius extend
borderRadius: {
  lg: 'var(--radius)',                 // 10px  cards/panels
  md: 'calc(var(--radius) - 3px)',     // 7px   buttons/inputs/badges
  sm: 'calc(var(--radius) - 5px)',     // 5px   chips/ticks
  full: '9999px',                      // pills / status dots
}
```

### 4.2 Spacing rhythm (intentional, NOT uniform)

- **App shell:** sidebar `w-60` (240px), top-bar `h-14` (56px), content gutter `px-6 py-5`.
- **Panels:** internal padding `p-4` for dense panels, `p-5` for hero/primary panels, `p-3` for table-dense.
- **Vertical rhythm between sections:** `space-y-6`; within a panel `space-y-3`.
- **Table density:** row height `h-9`, cell padding `px-3`, header row `h-8` with `label-eyebrow`.
- **Bento gaps:** `gap-4` (Overview grid). Controls cluster gap `gap-2`.
- Deliberately vary: hero metric panel gets more breathing room (`p-6`), log stream gets tight `px-3 py-2`.

### 4.3 Motion tokens

```css
:root {
  --dur-fast: 120ms;
  --dur-normal: 200ms;
  --dur-slow: 360ms;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```
```ts
// tailwind extend
transitionTimingFunction: { 'out-expo': 'cubic-bezier(0.16,1,0.3,1)', standard: 'cubic-bezier(0.2,0,0,1)' },
transitionDuration: { fast: '120ms', normal: '200ms', slow: '360ms' },
keyframes: {
  'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
  'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
  'pulse-live':  { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
  'stagger-in':  { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
  'log-flash':   { from: { backgroundColor: 'var(--signal-glow)' }, to: { backgroundColor: 'transparent' } },
},
animation: {
  'accordion-down': 'accordion-down 200ms ease-out',
  'accordion-up':   'accordion-up 200ms ease-out',
  'pulse-live':     'pulse-live 1.6s ease-in-out infinite',
  'stagger-in':     'stagger-in 360ms var(--ease-out-expo) both',
  'log-flash':      'log-flash 700ms ease-out',
},
```

Page-load stagger: apply `animation-delay` increments (`[--d:0ms]` → 40ms steps) to top-level panels.

### 4.4 prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  .animate-pulse-live { animation: none !important; opacity: 1 !important; }
}
```

---

## 5. Per-Screen Composition Direction

- **App shell / sidebar / top-bar.** Fixed `w-60` sidebar on `--bg-0` with a hairline right border; nav items are `font-display` rows with a left `signal` indicator bar + glow on active, `bg-2` on hover. Top-bar `h-14` on `--bg-1`, hairline bottom, holds breadcrumb (mono path), a global `cli-chip` copy affordance, live-hub status dot, and the theme toggle. Content area on `--bg-0` with `px-6 py-5` and page-load stagger.
- **Overview (bento).** Asymmetric bento grid (NOT uniform cards): one large hero metric panel (big mono number + sparkline + `label-eyebrow`), flanked by smaller status tiles using `status-badge` colors, a recent-jobs strip, and a workspace-health mini summary. Mixed panel sizes (`col-span-2`/`row-span-2`), `surface`/`surface-raised` elevation contrast, signal accent on the single primary CTA.
- **Workspace Graph (React Flow theming).** Canvas on `--bg-0` with a faint dot grid (`--bg-2` dots). Custom node = `surface-raised` card (`topology-node-card`) with mono name, status dot, and hairline border; selected node gets `glow-signal`; edges use `--border-strong` default, `--signal` on the active path, animated dash on live edges. Controls/minimap restyled to dark surfaces; node enter uses `stagger-in`.
- **Templates.** Dense responsive catalog (2–3 col) of `template-catalog-card` panels: `font-display` title, mono tag/category chips, short body, and a `signal` "use" action on hover-lift. Category filters as a sticky tracked-label row; hover raises elevation `elev-1 → elev-2`.
- **Command Builder.** Two-pane: left = form controls (compact labels + inputs on `--input`, `focus-ring`), right = sticky live `command-preview` rendered as a terminal block (`--bg-0`, mono, leading line marker) with a `cli-chip` copy affordance. Selected options highlight in signal; preview updates with a brief `log-flash`.
- **Jobs & Logs.** Master/detail: dense jobs table (left/top, `h-9` rows, mono ids/durations, `status-badge` per row) + `job-log-panel` streaming console (`--bg-0`, mono, auto-scroll). Running job shows `animate-pulse-live` signal dot; new log lines `log-flash`; level-colored lines (info/warn/critical map to status colors). Destructive cancel keeps the confirm gate, styled `destructive`.
- **Health.** `health-status` summary header (overall state in big `font-display` + status glow) over a dense grid of per-check rows: mono metric, threshold, and a `status-badge`. Group by severity; critical rows pinned top with `glow-critical` left border. Trend mini-bars use status colors.
- **Settings.** Calm single-column form sections separated by `hairline`, each with `label-eyebrow` section headers. Theme toggle is a prominent segmented control (dark default / light) using the signal accent for the active segment — flips `.dark`/`.light` on `<html>`. No card-soup; generous `space-y-6`.

---

## 6. Anti-Slop Checklist (verify before merge)

- [ ] NO flat gray-on-white — every surface sits on the elevation stack with a hairline + inner top highlight.
- [ ] NO default shadcn look — colors migrated to OKLCH tokens, radius tightened, fonts swapped to grotesk/mono/Inter.
- [ ] NO uniform cards — Overview is bento with mixed spans; padding varies by panel role (dense vs hero vs log).
- [ ] NO centered marketing hero — every screen is a working tool surface with clear left-aligned hierarchy.
- [ ] NO decorative-gradient-as-UI — depth comes from elevation + shadow + hairline, not background gradients.
- [ ] ONE accent only (signal lime) used SEMANTICALLY (primary action, active nav, focus, key data, live) — no rainbow.
- [ ] Distinct status colors (healthy/warn/critical/info) each with matching subtle glow on badges/graph.
- [ ] Mono for ALL numbers/paths/commands/logs with `tabular-nums`; grotesk for titles + uppercase tracked labels.
- [ ] Designed hover/focus/active states everywhere (hover-lift/glow, signal focus ring, active nav indicator).
- [ ] Motion is purposeful (stagger-in, live pulse, log-flash, node transitions) and fully disabled under `prefers-reduced-motion`.
- [ ] Dense scan-friendly tables (compact rows, eyebrow headers); copy-CLI affordance styled as a terminal chip.
- [ ] Refined light companion (cool paper + ink + darkened lime), intentional — NOT pastel.
- [ ] Looks like a real product screenshot (Vercel/Linear/Grafana-grade), typed, no `any`.
- [ ] Data flow, hub hooks, transport, and command logic UNCHANGED — presentation only; existing tests stay GREEN.

---

## 7. Migration order (for the implementation tasks that follow)

1. Install `@fontsource` packages + import weights; add `fontFamily` mapping.
2. Replace color vars in `globals.css` (dark + light + hex fallback); switch Tailwind `colors` from `hsl(var())` to `var()`; add custom tokens.
3. Add `boxShadow`, `borderRadius`, motion tokens + keyframes + reduced-motion rule.
4. Add `@layer components` utilities (surface, cli-chip, status-badge, label-eyebrow).
5. Restyle shadcn primitives (`button`, `card`, `badge`, `input`, `tabs`, …) to consume tokens/utilities.
6. Restyle `re-shell/*` domain components, then per-screen composition (Overview → Graph → … → Settings).
7. Run `vitest run` (hub + ui configs) and bounded `vite build`; fix only markup-moved tests, preserving asserted behavior.
