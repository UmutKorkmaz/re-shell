import {
  BRAND_SCRIPT_ID,
  DEFAULT_WHITE_LABEL,
  contrastRatio,
  resolveWhiteLabel,
  type ResolvedWhiteLabel,
} from '@re-shell/contracts';

/**
 * White-label support: the product name, logo, favicon and accent colour come from a config
 * file / environment at BUILD time (Vite plugin) or SERVE time (`re-shell ui`), which write the
 * resolved JSON into `<script id="re-shell-brand" type="application/json">` in index.html. The app
 * reads that block at boot, re-validates it with the same schema, and applies it across the shell
 * (document title, sidebar brand, favicon, accent), so no fork is needed to rebrand it.
 */

/** Built-in page backgrounds the accent has to stand out against (see ui globals.css). */
const BUILTIN_BACKGROUND = { light: 'oklch(0.97 0.004 265)', dark: 'oklch(0.16 0.012 265)' } as const;

/** Minimum contrast for the accent when it is used as a focus ring / indicator (WCAG 1.4.11). */
const INDICATOR_MIN_CONTRAST = 3;

export const BRAND_STYLE_ID = 're-shell-brand-style';

/**
 * Read the brand injected into the page. A missing block yields the defaults; an INVALID block
 * also yields the defaults, and is reported on the console, because an unreadable brand must not
 * take the dashboard down.
 */
export function readBrand(doc: Document = document): ResolvedWhiteLabel {
  const element = doc.getElementById(BRAND_SCRIPT_ID);
  const text = element?.textContent?.trim();
  if (!text) return DEFAULT_WHITE_LABEL;
  try {
    // The injected block is the RESOLVED config, which includes the derived accent ink. That field
    // is not part of the input schema and is never trusted: drop it and let resolveWhiteLabel
    // derive it again from the accent colour.
    const { accentForeground: _derived, ...input } = JSON.parse(text) as Record<string, unknown>;
    void _derived;
    const result = resolveWhiteLabel(input);
    if (result.ok) return result.config;
    const errors = (result as { errors: readonly string[] }).errors;
    console.warn(`[re-shell] ignoring invalid white-label config: ${errors.join('; ')}`);
  } catch (error) {
    console.warn(`[re-shell] ignoring unreadable white-label config: ${error instanceof Error ? error.message : String(error)}`);
  }
  return DEFAULT_WHITE_LABEL;
}

/**
 * CSS that applies the brand accent. The primary button always gets the accent with a derived
 * readable ink. The accent only replaces the `signal` / focus-ring tokens in a scheme where it is
 * visible enough against that scheme's background (>= 3:1); otherwise the built-in token is kept
 * so a pale brand colour can never make the focus ring or indicators disappear in one theme.
 */
export function brandAccentCss(brand: ResolvedWhiteLabel): string {
  if (!brand.accentColor || !brand.accentForeground) return '';
  const blocks: string[] = [];
  for (const scheme of ['light', 'dark'] as const) {
    const declarations = [`--primary:${brand.accentColor};`, `--primary-foreground:${brand.accentForeground};`];
    const ratio = contrastRatio(brand.accentColor, BUILTIN_BACKGROUND[scheme]);
    if (ratio !== null && ratio >= INDICATOR_MIN_CONTRAST) {
      declarations.push(`--signal:${brand.accentColor};`, `--ring:${brand.accentColor};`);
    }
    blocks.push(`:root.${scheme}{${declarations.join('')}}`);
  }
  return blocks.join('\n');
}

/** Apply the brand's accent and favicon to the document. */
export function applyBrand(brand: ResolvedWhiteLabel, doc: Document = document): void {
  const css = brandAccentCss(brand);
  const existing = doc.getElementById(BRAND_STYLE_ID);
  if (css === '') {
    existing?.remove();
  } else if (existing) {
    existing.textContent = css;
  } else {
    const style = doc.createElement('style');
    style.id = BRAND_STYLE_ID;
    style.textContent = css;
    doc.head.appendChild(style);
  }

  if (brand.favicon) {
    let link = doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = doc.createElement('link');
      link.rel = 'icon';
      doc.head.appendChild(link);
    }
    if (link.getAttribute('href') !== brand.favicon) {
      link.removeAttribute('type');
      link.setAttribute('href', brand.favicon);
    }
  }
}

/** `Overview · Acme Console`. */
export function documentTitle(screenLabel: string, brand: ResolvedWhiteLabel): string {
  return `${screenLabel} · ${brand.productName}`;
}
