/**
 * White-label HTML injection, shared by the dashboard build (the Vite plugin in apps/web) and by
 * `re-shell ui` when it serves the bundled dashboard. One config, applied the same way in both.
 */
import type { ResolvedWhiteLabel } from './ui-theme.js';

/** `id` of the `<script type="application/json">` element that carries the resolved brand. */
export const BRAND_SCRIPT_ID = 're-shell-brand';

/** Default config file names, searched in the workspace root, in this order. */
export const WHITE_LABEL_FILES = ['re-shell.whitelabel.json', '.re-shell/whitelabel.json'] as const;

/** Environment variable that points at a white-label config file. */
export const WHITE_LABEL_FILE_ENV = 'RE_SHELL_WHITE_LABEL_FILE';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** JSON that is safe inside a `<script>` element (no `</script>`, no U+2028/2029 line breaks). */
function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const TITLE_RE = /<title>[\s\S]*?<\/title>/i;
const ICON_RE = /<link\b[^>]*\brel=["']icon["'][^>]*>/i;
const BRAND_SCRIPT_RE = new RegExp(`<script\\b[^>]*\\bid=["']${BRAND_SCRIPT_ID}["'][^>]*>[\\s\\S]*?<\\/script>`, 'i');

/**
 * Apply a resolved white-label config to the dashboard's `index.html`: the `<title>`, the favicon
 * `<link>`, and the `<script id="re-shell-brand" type="application/json">` the app reads at boot
 * (sidebar brand, accent colour). A pure string transform; every interpolated value is escaped
 * for its context, so a brand name or URL cannot break out of the markup.
 */
export function renderBrandIntoHtml(html: string, brand: ResolvedWhiteLabel): string {
  let out = html;

  const title = `<title>${escapeHtml(brand.productName)}</title>`;
  out = TITLE_RE.test(out) ? out.replace(TITLE_RE, () => title) : out.replace(/<\/head>/i, () => `${title}</head>`);

  if (brand.favicon) {
    // The `type` attribute is dropped on purpose: a custom favicon may be png/ico/svg.
    const link = `<link rel="icon" href="${escapeHtml(brand.favicon)}" />`;
    out = ICON_RE.test(out) ? out.replace(ICON_RE, () => link) : out.replace(/<\/head>/i, () => `${link}</head>`);
  }

  const script = `<script id="${BRAND_SCRIPT_ID}" type="application/json">${scriptSafeJson(brand)}</script>`;
  out = BRAND_SCRIPT_RE.test(out) ? out.replace(BRAND_SCRIPT_RE, () => script) : out.replace(/<\/head>/i, () => `${script}</head>`);
  return out;
}
