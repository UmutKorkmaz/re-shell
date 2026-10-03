/**
 * Branded CSS length units.
 *
 * `Px`, `Rem` and `Percent` are template-literal strings branded with a phantom
 * symbol, so a bare `"12px"` or a `number` is rejected by the type checker and
 * the only way to obtain one is a constructor ({@link px}, {@link rem},
 * {@link percent}) or the runtime parser ({@link parseLength}). That keeps unit
 * mix-ups (passing rem where px is expected, a percentage as a gap) out of
 * layout code at compile time, while the values stay plain strings at runtime
 * (usable directly in a `style` object, no wrapper allocation).
 */

declare const unitBrand: unique symbol;

/** Brand a string type with a phantom unit tag. */
type Branded<Value extends string, Unit extends string> = Value & { readonly [unitBrand]: Unit };

/** A CSS length in pixels, e.g. `"12px"`. */
export type Px = Branded<`${number}px`, 'px'>;
/** A CSS length in root-em units, e.g. `"0.75rem"`. */
export type Rem = Branded<`${number}rem`, 'rem'>;
/** A CSS percentage, e.g. `"50%"`. */
export type Percent = Branded<`${number}%`, 'percent'>;

/** Any branded length. */
export type CssLength = Px | Rem | Percent;
/** Lengths that are valid as spacing (padding, margin, gap): no percentages. */
export type AbsoluteLength = Px | Rem;

/** The unit tag of a branded length. */
export type UnitOf<L extends CssLength> = L extends Px ? 'px' : L extends Rem ? 'rem' : 'percent';

/** The browser default root font size used for px <-> rem conversion. */
export const ROOT_FONT_SIZE_PX = 16;

function assertFinite(value: number, unit: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${unit}(): expected a finite number, received ${String(value)}`);
  }
}

/** Format without float noise (`0.1 + 0.2` -> `0.3`) and without `-0`. */
function format(value: number): string {
  const rounded = Math.round(value * 10_000) / 10_000;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** Create a pixel length. @throws {RangeError} for NaN / Infinity. */
export function px(value: number): Px {
  assertFinite(value, 'px');
  return `${format(value)}px` as Px;
}

/** Create a rem length. @throws {RangeError} for NaN / Infinity. */
export function rem(value: number): Rem {
  assertFinite(value, 'rem');
  return `${format(value)}rem` as Rem;
}

/** Create a percentage. @throws {RangeError} for NaN / Infinity. */
export function percent(value: number): Percent {
  assertFinite(value, 'percent');
  return `${format(value)}%` as Percent;
}

const LENGTH_RE = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|rem|%)$/;

/**
 * Parse an untrusted string (config, URL param, theme pack) into a branded
 * length, or `null` when it is not exactly `<number><px|rem|%>`.
 */
export function parseLength(input: string): CssLength | null {
  const match = LENGTH_RE.exec(input.trim());
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  switch (match[2]) {
    case 'px':
      return px(value);
    case 'rem':
      return rem(value);
    default:
      return percent(value);
  }
}

/** The numeric part of a branded length. */
export function lengthValue(length: CssLength): number {
  return Number.parseFloat(length);
}

/** Convert pixels to rem (`base` defaults to 16px). */
export function pxToRem(value: Px, base: number = ROOT_FONT_SIZE_PX): Rem {
  return rem(lengthValue(value) / base);
}

/** Convert rem to pixels (`base` defaults to 16px). */
export function remToPx(value: Rem, base: number = ROOT_FONT_SIZE_PX): Px {
  return px(lengthValue(value) * base);
}

/**
 * Add two lengths of the SAME unit. Adding px to rem (or either to a
 * percentage) is a compile error; use {@link pxToRem} / {@link remToPx} first.
 */
export function addLength<L extends CssLength>(a: L, b: L): L {
  const sum = lengthValue(a) + lengthValue(b);
  const unit = a.endsWith('px') ? 'px' : a.endsWith('rem') ? 'rem' : 'percent';
  return (unit === 'px' ? px(sum) : unit === 'rem' ? rem(sum) : percent(sum)) as L;
}

/** Multiply a length by a unitless factor, keeping its unit. */
export function scaleLength<L extends CssLength>(length: L, factor: number): L {
  assertFinite(factor, 'scaleLength');
  const product = lengthValue(length) * factor;
  const unit = length.endsWith('px') ? 'px' : length.endsWith('rem') ? 'rem' : 'percent';
  return (unit === 'px' ? px(product) : unit === 'rem' ? rem(product) : percent(product)) as L;
}

/** Clamp a length between two bounds of the same unit. */
export function clampLength<L extends CssLength>(length: L, min: L, max: L): L {
  const v = lengthValue(length);
  if (v < lengthValue(min)) return min;
  if (v > lengthValue(max)) return max;
  return length;
}

/** The spacing scale (Tailwind steps, 4px base) usable as a layout token. */
export const SPACE_TOKENS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12] as const;
/** A step on the spacing scale. */
export type SpaceToken = (typeof SPACE_TOKENS)[number];

/** A spacing value: a scale step or an absolute (non-percentage) length. */
export type Spacing = SpaceToken | AbsoluteLength;

/** Resolve a {@link Spacing} to a CSS length string. */
export function spacingToCss(value: Spacing): string {
  return typeof value === 'number' ? `${value * 0.25}rem` : value;
}

/** Type guard: is `value` a branded length string at runtime? */
export function isCssLength(value: unknown): value is CssLength {
  return typeof value === 'string' && LENGTH_RE.test(value);
}
