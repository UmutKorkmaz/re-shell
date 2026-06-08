/**
 * Ambient typing for the Vite build-time env the hub transport hooks read.
 *
 * These `VITE_*` vars are inlined by Vite at build time via direct
 * `import.meta.env.VITE_*` member access (see hooks/config.ts). Declaring
 * `ImportMetaEnv` here lets that access typecheck in the library build, which is
 * compiled with plain `tsc` (no Vite client types).
 */
interface ImportMetaEnv {
  readonly VITE_RE_SHELL_UI_HUB_TOKEN?: string;
  readonly VITE_RE_SHELL_UI_HUB_URL?: string;
  readonly VITE_RE_SHELL_UI_HOST?: string;
  readonly VITE_RE_SHELL_UI_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
