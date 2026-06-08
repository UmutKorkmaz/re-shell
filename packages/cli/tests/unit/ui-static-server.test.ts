import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildRuntimeConfigScript,
  injectRuntimeConfig,
  startStaticServer,
  type StaticServer
} from '../../src/utils/ui-static-server';

const HUB_URL = 'http://127.0.0.1:39912';
const HUB_TOKEN = 'unit-test-token-0123456789';

describe('buildRuntimeConfigScript', () => {
  it('serializes the hub url + token into a window global script', () => {
    const script = buildRuntimeConfigScript(HUB_URL, HUB_TOKEN);

    expect(script).toContain('window.__RE_SHELL_HUB__=');
    expect(script).toContain(HUB_URL);
    expect(script).toContain(HUB_TOKEN);
    expect(script.startsWith('<script>')).toBe(true);
    expect(script.endsWith('</script>')).toBe(true);
  });

  it('neutralizes closing script sequences inside the payload', () => {
    const script = buildRuntimeConfigScript('http://127.0.0.1/</script><b>', HUB_TOKEN);

    // The literal "</script>" must not appear inside the JSON payload, only as
    // the single trailing element terminator.
    const innerClosings = script.split('</script>').length - 1;
    expect(innerClosings).toBe(1);
    expect(script).toContain('<\\/script>');
  });
});

describe('injectRuntimeConfig', () => {
  it('inserts the runtime config immediately before the first module script', () => {
    const html =
      '<!doctype html><html><head><title>x</title>' +
      '<script type="module" src="/assets/app.js"></script>' +
      '</head><body></body></html>';

    const out = injectRuntimeConfig(html, HUB_URL, HUB_TOKEN);
    const globalAt = out.indexOf('window.__RE_SHELL_HUB__');
    const moduleAt = out.indexOf('type="module"');

    expect(globalAt).toBeGreaterThan(-1);
    expect(moduleAt).toBeGreaterThan(-1);
    expect(globalAt).toBeLessThan(moduleAt);
  });

  it('falls back to injecting before </head> when no module script exists', () => {
    const html = '<html><head><title>x</title></head><body></body></html>';
    const out = injectRuntimeConfig(html, HUB_URL, HUB_TOKEN);

    const globalAt = out.indexOf('window.__RE_SHELL_HUB__');
    const headCloseAt = out.indexOf('</head>');
    expect(globalAt).toBeGreaterThan(-1);
    expect(globalAt).toBeLessThan(headCloseAt);
  });

  it('falls back to injecting before </body> when there is no head', () => {
    const html = '<html><body><div id="root"></div></body></html>';
    const out = injectRuntimeConfig(html, HUB_URL, HUB_TOKEN);

    const globalAt = out.indexOf('window.__RE_SHELL_HUB__');
    const bodyCloseAt = out.indexOf('</body>');
    expect(globalAt).toBeGreaterThan(-1);
    expect(globalAt).toBeLessThan(bodyCloseAt);
  });

  it('prepends the script when there is no head or body', () => {
    const html = '<div id="root"></div>';
    const out = injectRuntimeConfig(html, HUB_URL, HUB_TOKEN);

    expect(out.startsWith('<script>')).toBe(true);
    expect(out).toContain('<div id="root"></div>');
  });
});

describe('startStaticServer', () => {
  let dashboardDir: string;
  let server: StaticServer | null = null;

  beforeEach(() => {
    dashboardDir = mkdtempSync(join(tmpdir(), 're-shell-static-'));
    mkdirSync(join(dashboardDir, 'assets'), { recursive: true });
    writeFileSync(
      join(dashboardDir, 'index.html'),
      '<!doctype html><html><head><title>Re-Shell</title>' +
        '<script type="module" src="/assets/app.js"></script></head>' +
        '<body><div id="root"></div></body></html>'
    );
    writeFileSync(join(dashboardDir, 'assets', 'app.css'), 'body{margin:0}');
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
    rmSync(dashboardDir, { recursive: true, force: true });
  });

  async function start(): Promise<StaticServer> {
    server = await startStaticServer({
      rootDir: dashboardDir,
      host: '127.0.0.1',
      port: 0,
      hubUrl: HUB_URL,
      hubToken: HUB_TOKEN
    });
    return server;
  }

  it('serves index.html with the per-launch runtime config injected', async () => {
    const s = await start();
    const res = await fetch(`${s.url}/`);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('window.__RE_SHELL_HUB__');
    expect(body).toContain(HUB_TOKEN);
    expect(body).toContain(HUB_URL);
  });

  it('serves static assets with the correct content type', async () => {
    const s = await start();
    const res = await fetch(`${s.url}/assets/app.css`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/css');
    expect(await res.text()).toContain('margin:0');
  });

  it('falls back to the injected index.html for unknown client routes', async () => {
    const s = await start();
    const res = await fetch(`${s.url}/workspace/graph`);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain('window.__RE_SHELL_HUB__');
  });

  it('returns 404 for a missing asset path', async () => {
    const s = await start();
    const res = await fetch(`${s.url}/assets/missing.js`);
    expect(res.status).toBe(404);
  });

  it('guards against path traversal outside the root', async () => {
    const s = await start();
    const res = await fetch(`${s.url}/../../package.json`);
    expect(res.status).toBe(404);
  });

  it('rejects non-GET/HEAD methods', async () => {
    const s = await start();
    const res = await fetch(`${s.url}/`, { method: 'POST' });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toContain('GET');
  });
});
