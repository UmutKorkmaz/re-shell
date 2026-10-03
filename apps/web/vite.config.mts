import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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

export default defineConfig({
  plugins: [
    react(),
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
  }
});
