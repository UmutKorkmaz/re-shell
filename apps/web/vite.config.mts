import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {
  WHITE_LABEL_FILES,
  WHITE_LABEL_FILE_ENV,
  renderBrandIntoHtml,
  resolveWhiteLabel,
  whiteLabelFromEnv,
} from '@re-shell/contracts';

/**
 * White-label: read the product name / logo / favicon / accent from a config file or the
 * environment at BUILD (and dev-server) time and write it into index.html: <title>, the favicon
 * <link> and the `re-shell-brand` JSON block the app reads at boot. Sources, highest priority first:
 *   RE_SHELL_BRAND_NAME / _TAGLINE / _LOGO / _FAVICON / _ACCENT   environment
 *   RE_SHELL_WHITE_LABEL_FILE, else re-shell.whitelabel.json (or .re-shell/whitelabel.json)
 *   in RE_SHELL_WORKSPACE or the current directory
 * An invalid config FAILS the build with the reasons; it is never silently ignored.
 */
function whiteLabelPlugin(): Plugin {
  const workspace = process.env.RE_SHELL_WORKSPACE ?? process.cwd();
  const explicit = process.env[WHITE_LABEL_FILE_ENV];
  const candidates = explicit ? [resolve(explicit)] : WHITE_LABEL_FILES.map((name) => resolve(workspace, name));
  const file = candidates.find((candidate) => existsSync(candidate));
  if (explicit && !file) {
    throw new Error(`${WHITE_LABEL_FILE_ENV}=${explicit} does not exist`);
  }
  let fromFile: unknown;
  if (file) {
    try {
      fromFile = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      throw new Error(`white-label config ${file} is not valid JSON: ${(error as Error).message}`);
    }
  }
  const result = resolveWhiteLabel(fromFile, whiteLabelFromEnv(process.env));
  if (!result.ok) {
    const errors = (result as { errors: readonly string[] }).errors;
    throw new Error(`Invalid white-label config${file ? ` (${file})` : ''}:\n  ${errors.join('\n  ')}`);
  }
  const brand = result.config;
  return {
    name: 're-shell-white-label',
    transformIndexHtml: (html) => renderBrandIntoHtml(html, brand),
  };
}

/** Opt-in bundle report: `ANALYZE=1 pnpm build` writes an interactive treemap (gzip sizes). */
async function bundleReportPlugin(): Promise<Plugin[]> {
  if (!process.env.ANALYZE) return [];
  const { visualizer } = await import('rollup-plugin-visualizer');
  return [
    visualizer({
      filename: 'node_modules/.cache/bundle-report/stats.html',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
    }) as Plugin,
  ];
}

// Hub server configuration
const HUB_PORT = Number.parseInt(process.env.VITE_RE_SHELL_UI_HUB_PORT || '3334', 10);
const HUB_URL = process.env.VITE_RE_SHELL_UI_HUB_URL || `http://127.0.0.1:${HUB_PORT}`;

// Dynamically import hub-server to allow graceful handling if it doesn't exist
async function loadHubServer() {
  try {
    const hub = await import('./src/hub-server');
    return hub;
  } catch {
    return null;
  }
}

export default defineConfig(async (): Promise<UserConfig> => ({
  plugins: [
    react(),
    whiteLabelPlugin(),
    ...(await bundleReportPlugin()),
    {
      name: 'hub-server',
      async configureServer(server) {
        // When launched via `re-shell ui`, the CLI already spawns and owns the
        // hub (and tears it down on exit). Starting a second in-process hub here
        // would EADDRINUSE on the same port and split lifecycle ownership, so
        // the plugin stands down and trusts the CLI-managed hub URL/port that
        // were injected into the environment.
        if (process.env.RE_SHELL_UI_HUB_MANAGED === '1') {
          console.log(`[hub-server] Using CLI-managed hub at ${HUB_URL}`);
          return;
        }

        // Under `tauri dev` the Tauri CLI exports TAURI_ENV_PLATFORM to the dev
        // command. The desktop shell spawns and owns its own hub (random port +
        // token, injected into the webview at runtime), so this plugin must not
        // start a second, token-less one.
        if (process.env.TAURI_ENV_PLATFORM) {
          console.log('[hub-server] Desktop shell owns the hub; not starting one here');
          return;
        }

        const hub = await loadHubServer();
        if (!hub) {
          console.warn('[hub-server] hub-server.ts not found, skipping hub server startup');
          return;
        }

        try {
          const hubInfo = await hub.startHubServer({ port: HUB_PORT });

          // Set environment variables for the frontend
          server.config.env.VITE_RE_SHELL_UI_HUB_PORT = String(hubInfo.port);
          server.config.env.VITE_RE_SHELL_UI_HUB_URL = hubInfo.url;

          // Also inject into define config for Vite's client. `server.config`
          // is a ResolvedConfig whose `define` property is readonly but always
          // present, so mutate the existing object in place rather than
          // reassigning the property.
          const define = server.config.define as Record<string, string>;
          define['import.meta.env.VITE_RE_SHELL_UI_HUB_PORT'] = JSON.stringify(
            String(hubInfo.port)
          );
          define['import.meta.env.VITE_RE_SHELL_UI_HUB_URL'] = JSON.stringify(hubInfo.url);

          // This in-process (standalone `vite dev`) hub is owned by the dev
          // server: tear it down when the server closes so a `pnpm dev` exit
          // never orphans a hub on the port.
          server.httpServer?.once('close', () => {
            void hub.stopHubServer(hubInfo.server);
          });

          console.log(`[hub-server] Hub server running at ${hubInfo.url}`);
        } catch (err) {
          console.error('[hub-server] Failed to start hub server:', err);
        }
      },
    },
  ],
  server: {
    port: 3333,
    open: false
  },
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks: long-lived in the browser cache and separated from app code.
        // Screens are lazy chunks (see App.tsx); React Flow is only ever pulled in by the
        // Workspace Graph screen, so it never loads for anyone who does not open that screen.
        manualChunks(id: string): string | undefined {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(@xyflow|d3-[a-z-]+|classcat|zustand)\//.test(id)) return 'vendor-xyflow';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (/node_modules\/@tanstack\//.test(id)) return 'vendor-query';
          if (/node_modules\/(@radix-ui|@floating-ui|react-remove-scroll[a-z-]*|react-style-singleton|use-callback-ref|use-sidecar|aria-hidden|get-nonce|tslib)\//.test(id)) {
            return 'vendor-radix';
          }
          if (/node_modules\/zod\//.test(id)) return 'vendor-zod';
          return undefined;
        },
      },
    },
  },
}));
