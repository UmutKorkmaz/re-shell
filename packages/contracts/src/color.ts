/**
 * Colour math shared by the theme-pack / white-label schemas and by the UI
 * contrast tests: OKLCH + hex parsing, conversion to linear sRGB, WCAG 2.x
 * relative luminance and contrast ratio.
 *
 * Pure functions, no dependencies. Out-of-gamut OKLCH values are clipped to the
 * sRGB gamut per channel, which is what browsers do for display on an sRGB
 * screen, so the computed ratio matches what a user actually sees closely
 * enough for AA decisions.
 */

/** A parsed colour in OKLCH. `l` is 0..1, `c` is >= 0, `h` is degrees, `alpha` 0..1. */
export interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
  readonly alpha: number;
}

/** Linear-light sRGB channels, each clipped to 0..1. */
export interface LinearRgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const NUMBER = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)';
const OKLCH_RE = new RegExp(
  `^oklch\\(\\s*(${NUMBER})(%?)\\s+(${NUMBER})(%?)\\s+(${NUMBER})(deg)?\\s*(?:/\\s*(${NUMBER})(%?)\\s*)?\\)$`,
  'i'
);

/**
 * Strict textual form of an OKLCH colour accepted in theme packs. Only the
 * modern space-separated syntax is allowed, so a validated value can be
 * interpolated into a CSS custom property without any escaping concerns.
 */
export const OKLCH_PATTERN = OKLCH_RE;

/** `#rgb`, `#rrggbb` (alpha is not accepted for brand colours). */
export const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Parse an `oklch(L C H / A)` string. Returns `null` when the string is not a
 * well-formed, in-range OKLCH colour (L 0..1 or 0%..100%, C 0..0.5 or 0%..125%,
 * H any finite angle, alpha 0..1 or 0%..100%).
 */
export function parseOklch(input: string): Oklch | null {
  const match = OKLCH_RE.exec(input.trim());
  if (!match) return null;
  const [, lRaw, lPct, cRaw, cPct, hRaw, , aRaw, aPct] = match;
  let l = Number(lRaw);
  if (lPct === '%') l /= 100;
  let c = Number(cRaw);
  if (cPct === '%') c = (c / 100) * 0.4;
  const h = Number(hRaw);
  let alpha = aRaw === undefined ? 1 : Number(aRaw);
  if (aPct === '%') alpha /= 100;
  if (![l, c, h, alpha].every(Number.isFinite)) return null;
  if (l < 0 || l > 1 || c < 0 || c > 0.5 || alpha < 0 || alpha > 1) return null;
  return { l, c, h: ((h % 360) + 360) % 360, alpha };
}

/** Convert an OKLCH colour to clipped linear-light sRGB. */
export function oklchToLinearRgb({ l, c, h }: Oklch): LinearRgb {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;

  const clip = (v: number): number => Math.min(1, Math.max(0, v));
  return {
    r: clip(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S),
    g: clip(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S),
    b: clip(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S),
  };
}

/** sRGB (0..255) -> linear light (0..1). */
function srgbChannelToLinear(value: number): number {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Parse `#rgb` / `#rrggbb` to linear-light sRGB, or `null`. */
export function parseHexToLinearRgb(input: string): LinearRgb | null {
  if (!HEX_PATTERN.test(input)) return null;
  let hex = input.slice(1);
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  const n = Number.parseInt(hex, 16);
  return {
    r: srgbChannelToLinear((n >> 16) & 255),
    g: srgbChannelToLinear((n >> 8) & 255),
    b: srgbChannelToLinear(n & 255),
  };
}

/** Parse an OKLCH or hex colour to linear-light sRGB, or `null` when invalid. */
export function parseColorToLinearRgb(input: string): LinearRgb | null {
  const trimmed = input.trim();
  const ok = parseOklch(trimmed);
  if (ok) return oklchToLinearRgb(ok);
  return parseHexToLinearRgb(trimmed);
}

/** Linear light (0..1) -> sRGB-encoded byte (0..255). */
function linearToSrgbByte(value: number): number {
  const v = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

/** Convert a clipped linear-light colour to `#rrggbb`. */
export function linearRgbToHex({ r, g, b }: LinearRgb): string {
  const byte = (v: number): string => linearToSrgbByte(v).toString(16).padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/** WCAG 2.x relative luminance of a linear-light sRGB colour. */
export function relativeLuminance({ r, g, b }: LinearRgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio (1..21) between two opaque colours given as OKLCH or hex
 * strings. Returns `null` when either colour cannot be parsed.
 */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseColorToLinearRgb(foreground);
  const bg = parseColorToLinearRgb(background);
  if (!fg || !bg) return null;
  const lf = relativeLuminance(fg);
  const lb = relativeLuminance(bg);
  const [hi, lo] = lf >= lb ? [lf, lb] : [lb, lf];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Composite a (possibly translucent) foreground over an opaque background in
 * linear light and return the contrast against that background. Used for
 * tinted status badges (`bg-warn/10` etc.).
 */
export function compositeOver(
  foreground: LinearRgb,
  alpha: number,
  background: LinearRgb
): LinearRgb {
  const mix = (f: number, b: number): number => f * alpha + b * (1 - alpha);
  return { r: mix(foreground.r, background.r), g: mix(foreground.g, background.g), b: mix(foreground.b, background.b) };
}

/** Contrast ratio between two linear-light colours. */
export function contrastRatioLinear(a: LinearRgb, b: LinearRgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** The better of near-black / near-white ink for text drawn on `background`. */
export function readableInkOn(background: string): '#0b0d11' | '#ffffff' | null {
  const dark = contrastRatio('#0b0d11', background);
  const light = contrastRatio('#ffffff', background);
  if (dark === null || light === null) return null;
  return dark >= light ? '#0b0d11' : '#ffffff';
}
