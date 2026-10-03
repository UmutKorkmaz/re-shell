/**
 * Theme packs and white-label configuration for the Re-Shell dashboard.
 *
 * A theme pack is a JSON token set: OKLCH colours per colour scheme (light /
 * dark), a corner radius, and font stacks. It is validated here so the same
 * rules guard every entry point (dashboard install-from-URL/file, the
 * `re-shell ui theme` CLI, an npm package tagged `reshell-theme`).
 *
 * Every value is validated against a strict grammar before it can reach a CSS
 * custom property, so a hostile pack cannot inject arbitrary CSS. Packs whose
 * text/background token pairs fall below WCAG 2.x AA are rejected as well: an
 * installed theme must never make the dashboard unreadable.
 */
import { z } from 'zod';
import { HEX_PATTERN, contrastRatio, parseOklch, readableInkOn } from './color.js';

export * from './color.js';

/** The `reshell-theme` npm keyword that makes a package discoverable. */
export const THEME_PACK_KEYWORD = 'reshell-theme';

/** Current theme pack schema version. */
export const THEME_PACK_SCHEMA_VERSION = 1;

/** Largest accepted theme pack document, in bytes of JSON text. */
export const THEME_PACK_MAX_BYTES = 64 * 1024;

/** Every colour token a theme pack may set. Names equal the CSS variable names. */
export const THEME_COLOR_TOKENS = [
  'background',
  'foreground',
  'bg-0',
  'bg-1',
  'bg-2',
  'bg-3',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'muted',
  'muted-foreground',
  'secondary',
  'secondary-foreground',
  'primary',
  'primary-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'border-strong',
  'control',
  'input',
  'ring',
  'signal',
  'signal-foreground',
  'status-healthy',
  'status-healthy-foreground',
  'status-warn',
  'status-warn-foreground',
  'status-critical',
  'status-critical-foreground',
  'status-info',
  'status-info-foreground',
] as const;

export type ThemeColorToken = (typeof THEME_COLOR_TOKENS)[number];

/** Tokens every colour scheme must define; the rest inherit the built-in value. */
export const THEME_REQUIRED_TOKENS = [
  'background',
  'foreground',
  'primary',
  'primary-foreground',
] as const satisfies readonly ThemeColorToken[];

const TOKEN_SET: ReadonlySet<string> = new Set(THEME_COLOR_TOKENS);

/** A single OKLCH colour (modern space-separated syntax, in range). */
export const oklchColorSchema = z
  .string()
  .max(64)
  .refine((value) => parseOklch(value) !== null, {
    message: 'must be an OKLCH colour such as "oklch(0.74 0.18 130)" or "oklch(0.2 0.01 265 / 0.5)"',
  });

/** A CSS length in rem, 0..2rem, used for the corner radius token. */
export const radiusSchema = z
  .string()
  .regex(/^(?:\d+|\d*\.\d+)rem$/, 'must be a rem length such as "0.625rem"')
  .refine((value) => Number.parseFloat(value) <= 2, { message: 'radius must be at most 2rem' });

/**
 * A single font family or a comma-separated stack. Family names are plain words
 * (optionally double-quoted); no `;`, `{}`, `url()`, `\` or `/` can appear.
 */
const FONT_NAME = String.raw`(?:"[A-Za-z0-9][A-Za-z0-9 _-]{0,47}"|[A-Za-z0-9][A-Za-z0-9_-]{0,47})`;
const FONT_STACK_RE = new RegExp(String.raw`^${FONT_NAME}(?:\s*,\s*${FONT_NAME}){0,7}$`);

export const fontStackSchema = z
  .string()
  .max(400)
  .regex(FONT_STACK_RE, 'must be a comma-separated list of font family names (no url(), braces or semicolons)');

export const themeFontsSchema = z
  .object({
    display: fontStackSchema.optional(),
    sans: fontStackSchema.optional(),
    mono: fontStackSchema.optional(),
  })
  .strict();

/** Colours for one colour scheme. Unknown token names are rejected. */
export const themeColorsSchema = z
  .record(z.string(), oklchColorSchema)
  .superRefine((colors, ctx) => {
    for (const key of Object.keys(colors)) {
      if (!TOKEN_SET.has(key)) {
        ctx.addIssue({ code: 'custom', path: [key], message: `unknown colour token "${key}"` });
      }
    }
    for (const required of THEME_REQUIRED_TOKENS) {
      if (colors[required] === undefined) {
        ctx.addIssue({ code: 'custom', path: [required], message: `required colour token "${required}" is missing` });
      }
    }
  });

/** Pairs of [text token, surface token, minimum ratio] enforced at install time. */
export const THEME_CONTRAST_PAIRS: ReadonlyArray<readonly [ThemeColorToken, ThemeColorToken, number]> = [
  ['foreground', 'background', 4.5],
  ['card-foreground', 'card', 4.5],
  ['popover-foreground', 'popover', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'card', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['secondary-foreground', 'secondary', 4.5],
  ['accent-foreground', 'accent', 4.5],
  ['destructive-foreground', 'destructive', 4.5],
  ['signal-foreground', 'signal', 4.5],
  ['status-healthy-foreground', 'status-healthy', 4.5],
  ['status-warn-foreground', 'status-warn', 4.5],
  ['status-critical-foreground', 'status-critical', 4.5],
  ['status-info-foreground', 'status-info', 4.5],
  // Status / accent colours are drawn as text and icons on the page surfaces.
  ['status-healthy', 'background', 4.5],
  ['status-warn', 'background', 4.5],
  ['status-critical', 'background', 4.5],
  ['status-info', 'background', 4.5],
  ['signal', 'background', 3],
  // The focus ring is a UI-component state indicator (WCAG 1.4.11).
  ['ring', 'background', 3],
];

/** One contrast failure found in a theme pack. */
export interface ThemeContrastIssue {
  readonly scheme: 'light' | 'dark';
  readonly foreground: ThemeColorToken;
  readonly background: ThemeColorToken;
  readonly ratio: number;
  readonly required: number;
}

/**
 * Check every enforced token pair that the colour scheme defines on both sides.
 * Pairs with a missing side are skipped (they inherit the built-in value).
 * Translucent colours are skipped: their rendered ratio depends on what is
 * behind them.
 */
export function findThemeContrastIssues(
  scheme: 'light' | 'dark',
  colors: Readonly<Record<string, string>>
): ThemeContrastIssue[] {
  const issues: ThemeContrastIssue[] = [];
  for (const [fg, bg, required] of THEME_CONTRAST_PAIRS) {
    const fgValue = colors[fg];
    const bgValue = colors[bg];
    if (fgValue === undefined || bgValue === undefined) continue;
    const parsedFg = parseOklch(fgValue);
    const parsedBg = parseOklch(bgValue);
    if (!parsedFg || !parsedBg || parsedFg.alpha < 1 || parsedBg.alpha < 1) continue;
    const ratio = contrastRatio(fgValue, bgValue);
    if (ratio !== null && ratio < required) {
      issues.push({ scheme, foreground: fg, background: bg, ratio: Math.round(ratio * 100) / 100, required });
    }
  }
  return issues;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** Plain, markup-free display text (no angle brackets or control characters). */
const plainText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    // eslint-disable-next-line no-control-regex
    .refine((value) => !/[<>\u0000-\u001f]/.test(value), { message: 'must not contain markup or control characters' });

/** The theme pack document. */
export const themePackSchema = z
  .object({
    schemaVersion: z.literal(THEME_PACK_SCHEMA_VERSION),
    /** Stable slug; used as the storage key and the npm package suffix. */
    id: z.string().regex(SLUG_RE, 'must be a lowercase slug (a-z, 0-9, "-")'),
    name: plainText(60),
    version: z.string().regex(SEMVER_RE, 'must be a semver version'),
    description: plainText(280).optional(),
    author: plainText(80).optional(),
    radius: radiusSchema.optional(),
    fonts: themeFontsSchema.optional(),
    colors: z
      .object({
        light: themeColorsSchema.optional(),
        dark: themeColorsSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((pack, ctx) => {
    if (!pack.colors.light && !pack.colors.dark) {
      ctx.addIssue({ code: 'custom', path: ['colors'], message: 'define at least one of "light" or "dark"' });
      return;
    }
    for (const scheme of ['light', 'dark'] as const) {
      const colors = pack.colors[scheme];
      if (!colors) continue;
      for (const issue of findThemeContrastIssues(scheme, colors)) {
        ctx.addIssue({
          code: 'custom',
          path: ['colors', scheme, issue.foreground],
          message: `${issue.foreground} on ${issue.background} has contrast ${issue.ratio}:1 in the ${scheme} scheme; WCAG AA needs ${issue.required}:1`,
        });
      }
    }
  });

export type ThemePack = z.infer<typeof themePackSchema>;
export type ThemeFonts = z.infer<typeof themeFontsSchema>;

/** Result of {@link parseThemePack}. */
export type ThemePackParseResult =
  | { readonly ok: true; readonly pack: ThemePack }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Parse and validate untrusted theme pack JSON text (or an already parsed
 * value). Never throws; failures come back as readable `path: message` lines.
 */
export function parseThemePack(input: unknown): ThemePackParseResult {
  let value: unknown = input;
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).length > THEME_PACK_MAX_BYTES) {
      return { ok: false, errors: [`theme pack exceeds ${THEME_PACK_MAX_BYTES} bytes`] };
    }
    try {
      value = JSON.parse(input);
    } catch (error) {
      return { ok: false, errors: [`not valid JSON: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }
  const result = themePackSchema.safeParse(value);
  if (result.success) return { ok: true, pack: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    }),
  };
}

/**
 * Render a validated pack as CSS: one rule per colour scheme that overrides the
 * custom properties, plus the shared radius / font variables on `:root`.
 *
 * The scheme selectors are `:root.light` / `:root.dark`, which out-rank the
 * built-in `:root` / `.light` / `.dark` blocks. Safe to inject into a `<style>`
 * element because every value has passed {@link themePackSchema}.
 */
export function renderThemePackCss(pack: ThemePack): string {
  const blocks: string[] = [];
  const shared: string[] = [];
  if (pack.radius) shared.push(`--radius:${pack.radius};`);
  if (pack.fonts?.display) shared.push(`--font-display:${pack.fonts.display};`);
  if (pack.fonts?.sans) shared.push(`--font-sans:${pack.fonts.sans};`);
  if (pack.fonts?.mono) shared.push(`--font-mono:${pack.fonts.mono};`);
  // `:root:root` out-ranks the built-in `:root, .dark` block regardless of order.
  if (shared.length > 0) blocks.push(`:root:root{${shared.join('')}}`);
  for (const scheme of ['light', 'dark'] as const) {
    const colors = pack.colors[scheme];
    if (!colors) continue;
    const declarations = Object.entries(colors).map(([token, value]) => `--${token}:${value};`);
    // `bg-0..3` / `background` etc. are real tokens; nothing is derived here.
    blocks.push(`:root.${scheme}{${declarations.join('')}}`);
  }
  return blocks.join('\n');
}

// ---------------------------------------------------------------------------
// White-label configuration
// ---------------------------------------------------------------------------

/** Defaults applied when no white-label configuration is present. */
export const DEFAULT_PRODUCT_NAME = 'Re-Shell';

const brandUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (value) => {
      if (/^data:image\/(?:png|svg\+xml|webp|x-icon|vnd\.microsoft\.icon|jpeg|gif);/i.test(value)) return value.length <= 256 * 1024;
      if (/^(?:\/(?!\/)|\.\/|\.\.\/)[^\s"'<>]*$/.test(value)) return true;
      try {
        const url = new URL(value);
        return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
      } catch {
        return false;
      }
    },
    { message: 'must be an https:// URL, a same-origin path ("/logo.svg") or a data:image/... URI' }
  );

/** A brand accent colour: OKLCH or hex. Contrast against the ink is derived, not trusted. */
export const brandAccentSchema = z
  .string()
  .trim()
  .refine((value) => parseOklch(value) !== null || HEX_PATTERN.test(value), {
    message: 'must be an OKLCH colour or a #rgb / #rrggbb hex colour',
  });

export const whiteLabelSchema = z
  .object({
    productName: plainText(40).default(DEFAULT_PRODUCT_NAME),
    /** Short line shown under the product name in the sidebar. */
    tagline: plainText(60).optional(),
    logo: brandUrlSchema.optional(),
    favicon: brandUrlSchema.optional(),
    accentColor: brandAccentSchema.optional(),
  })
  .strict();

export type WhiteLabelConfig = z.infer<typeof whiteLabelSchema>;

/** A white-label config with every field resolved for rendering. */
export interface ResolvedWhiteLabel {
  readonly productName: string;
  readonly tagline?: string;
  readonly logo?: string;
  readonly favicon?: string;
  readonly accentColor?: string;
  /** Readable ink for text on the accent colour, derived from contrast. */
  readonly accentForeground?: string;
}

export const DEFAULT_WHITE_LABEL: ResolvedWhiteLabel = { productName: DEFAULT_PRODUCT_NAME };

/** Minimum contrast between the accent and the page for it to be used as text/indicator. */
export const BRAND_ACCENT_MIN_CONTRAST = 3;

/** Result of {@link resolveWhiteLabel}. */
export type WhiteLabelResult =
  | { readonly ok: true; readonly config: ResolvedWhiteLabel }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Environment variables read by {@link whiteLabelFromEnv}. */
export const WHITE_LABEL_ENV = {
  productName: 'RE_SHELL_BRAND_NAME',
  tagline: 'RE_SHELL_BRAND_TAGLINE',
  logo: 'RE_SHELL_BRAND_LOGO',
  favicon: 'RE_SHELL_BRAND_FAVICON',
  accentColor: 'RE_SHELL_BRAND_ACCENT',
} as const;

/** Pick the white-label fields out of an environment-like record. */
export function whiteLabelFromEnv(env: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, name] of Object.entries(WHITE_LABEL_ENV)) {
    const value = env[name];
    if (typeof value === 'string' && value.trim() !== '') out[field] = value.trim();
  }
  return out;
}

/**
 * Validate and resolve white-label input. `fileValue` is the parsed config
 * file, `envValue` the {@link whiteLabelFromEnv} result; environment values win
 * over the file. An empty input resolves to the defaults.
 */
export function resolveWhiteLabel(fileValue: unknown, envValue: Readonly<Record<string, string>> = {}): WhiteLabelResult {
  const merged: Record<string, unknown> = {
    ...(typeof fileValue === 'object' && fileValue !== null && !Array.isArray(fileValue) ? (fileValue as Record<string, unknown>) : {}),
    ...envValue,
  };
  if (fileValue !== undefined && fileValue !== null && (typeof fileValue !== 'object' || Array.isArray(fileValue))) {
    return { ok: false, errors: ['white-label config must be a JSON object'] };
  }
  const parsed = whiteLabelSchema.safeParse(merged);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    };
  }
  const { accentColor } = parsed.data;
  let accentForeground: string | undefined;
  if (accentColor) {
    const ink = readableInkOn(accentColor);
    if (ink === null) return { ok: false, errors: ['accentColor: could not be evaluated'] };
    accentForeground = ink;
  }
  return {
    ok: true,
    config: {
      productName: parsed.data.productName,
      ...(parsed.data.tagline ? { tagline: parsed.data.tagline } : {}),
      ...(parsed.data.logo ? { logo: parsed.data.logo } : {}),
      ...(parsed.data.favicon ? { favicon: parsed.data.favicon } : {}),
      ...(accentColor ? { accentColor, accentForeground } : {}),
    },
  };
}
