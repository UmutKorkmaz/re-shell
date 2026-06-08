import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Minimal, dependency-free static file server for the bundled dashboard SPA.
 *
 * Responsibilities:
 *  - Serve the prebuilt SPA from a directory (dist/dashboard) on the configured
 *    loopback host/port.
 *  - SPA fallback: any non-asset, non-file route resolves to index.html.
 *  - Correct content types for the assets the Vite build emits.
 *  - Inject the PER-LAUNCH runtime hub config into index.html on the fly:
 *    `<script>window.__RE_SHELL_HUB__={url,token}</script>` placed BEFORE the
 *    app's module script so the SPA's resolvers pick it up at boot.
 *
 * The prebuilt bundle never bakes in a token; the token + hub url are random
 * per launch and supplied here at request time.
 */

export interface StaticServerOptions {
  /** Absolute path to the directory containing index.html + assets. */
  rootDir: string;
  /** Loopback host to bind. */
  host: string;
  /** Port to bind. */
  port: number;
  /** Per-launch hub base URL injected into the SPA at runtime. */
  hubUrl: string;
  /** Per-launch hub session token injected into the SPA at runtime. */
  hubToken: string;
}

export interface StaticServer {
  server: http.Server;
  url: string;
  close(): Promise<void>;
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? DEFAULT_CONTENT_TYPE;
}

/**
 * Build the runtime-config script tag. The values are JSON-serialized so they
 * are safely escaped; `</script>` sequences inside the JSON are neutralized to
 * prevent breaking out of the script element.
 */
export function buildRuntimeConfigScript(hubUrl: string, hubToken: string): string {
  const payload = JSON.stringify({ url: hubUrl, token: hubToken }).replace(/<\//g, '<\\/');
  return `<script>window.__RE_SHELL_HUB__=${payload};</script>`;
}

/**
 * Insert the runtime-config script into the SPA shell BEFORE the app's first
 * module script so the global is present before any app code resolves the hub.
 * Falls back to injecting before </head>, then before </body>, then prepending.
 */
export function injectRuntimeConfig(html: string, hubUrl: string, hubToken: string): string {
  const script = buildRuntimeConfigScript(hubUrl, hubToken);

  const moduleScriptMatch = html.match(/<script\b[^>]*type=["']module["'][^>]*>/i);
  if (moduleScriptMatch && moduleScriptMatch.index !== undefined) {
    const at = moduleScriptMatch.index;
    return `${html.slice(0, at)}${script}${html.slice(at)}`;
  }

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${script}</head>`);
  }

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${script}</body>`);
  }

  return `${script}${html}`;
}

/**
 * Resolve a request pathname to an absolute file path inside rootDir, guarding
 * against path traversal. Returns null when the resolved path escapes rootDir.
 */
function resolveSafePath(rootDir: string, pathname: string): string | null {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.replace(/^\/+/, '');
  const resolved = path.resolve(rootDir, relative);
  const rootWithSep = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;

  if (resolved !== rootDir && !resolved.startsWith(rootWithSep)) {
    return null;
  }

  return resolved;
}

function statFileSync(filePath: string): fs.Stats | null {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile() ? stats : null;
  } catch {
    return null;
  }
}

function sendNotFound(res: http.ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
}

function sendIndexHtml(res: http.ServerResponse, options: StaticServerOptions): void {
  const indexPath = path.join(options.rootDir, 'index.html');
  let html: string;
  try {
    html = fs.readFileSync(indexPath, 'utf8');
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Dashboard index.html is missing.');
    return;
  }

  const injected = injectRuntimeConfig(html, options.hubUrl, options.hubToken);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(injected);
}

function sendFile(res: http.ServerResponse, filePath: string, stats: fs.Stats): void {
  res.writeHead(200, {
    'Content-Type': contentTypeFor(filePath),
    'Content-Length': stats.size
  });
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(500);
    }
    res.end();
  });
  stream.pipe(res);
}

function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: StaticServerOptions
): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  const url = new URL(req.url ?? '/', `http://${options.host}:${options.port}`);
  const pathname = url.pathname;

  // Root and index.html always get the runtime-config-injected shell.
  if (pathname === '/' || pathname === '/index.html') {
    sendIndexHtml(res, options);
    return;
  }

  const safePath = resolveSafePath(options.rootDir, pathname);
  if (safePath === null) {
    sendNotFound(res);
    return;
  }

  const stats = statFileSync(safePath);
  if (stats) {
    sendFile(res, safePath, stats);
    return;
  }

  // SPA fallback: an unknown route with no file extension is a client-side
  // route, so serve the injected index.html. A missing asset (with extension)
  // is a genuine 404.
  if (path.extname(pathname) === '') {
    sendIndexHtml(res, options);
    return;
  }

  sendNotFound(res);
}

/**
 * Start the static SPA server. Binds the provided loopback host/port and
 * resolves once listening.
 */
export function startStaticServer(options: StaticServerOptions): Promise<StaticServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        handleRequest(req, res, options);
      } catch {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        }
        res.end('Internal Server Error');
      }
    });

    server.once('error', reject);
    server.listen(options.port, options.host, () => {
      server.removeListener('error', reject);
      // Use the actually-bound port: when options.port is 0 the OS assigns an
      // ephemeral port, so building the URL from options.port would yield :0.
      const address = server.address();
      const boundPort = address && typeof address === 'object' ? address.port : options.port;
      const url = `http://${options.host}:${boundPort}`;
      resolve({
        server,
        url,
        close: () =>
          new Promise<void>(resolveClose => {
            server.close(() => resolveClose());
          })
      });
    });
  });
}
