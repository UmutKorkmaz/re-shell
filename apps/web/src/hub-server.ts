import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { WebSocketServer, WebSocket } from 'ws';
import type { Socket } from 'node:net';
import {
  wsAuthMessageSchema,
  wsJobMessageSchema,
  type SseEvent,
  type WsServerMessage,
} from '@re-shell/contracts';
import { resolveCommand } from './hub/command-registry.js';

export interface HubServerInfo {
  port: number;
  url: string;
  server: http.Server;
}

export interface StartHubServerOptions {
  // Note: host is intentionally NOT accepted. The hub always binds to the
  // loopback interface (127.0.0.1) to prevent it from being reachable off-host.
  port?: number;
}

// WebSocket close codes. 1008 is the standard "policy violation" code, used
// here for auth/origin rejections on the WS upgrade or first message.
const WS_POLICY_VIOLATION = 1008;

// Custom Sec-WebSocket-Protocol prefix used to smuggle the session token on the
// browser WebSocket handshake (the browser WS API cannot set custom headers).
const WS_TOKEN_PROTOCOL_PREFIX = 're-shell-token.';

// The wire messages (WsClientMessage / WsServerMessage / SseEvent) are NOT
// re-declared here: they are the zod schemas in @re-shell/contracts, the same
// ones the browser clients validate against. Every frame the hub writes is typed
// against them, and every frame it reads is validated with them.

/** Write one server->client WebSocket frame (typed against the contract). */
function sendWs(ws: WebSocket, message: WsServerMessage): void {
  ws.send(JSON.stringify(message));
}

/** Write one Server-Sent Event (typed against the contract). */
function writeSseEvent(res: http.ServerResponse, event: SseEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Report a client frame that failed contract validation. A frame whose `type` is
 * not a job-control type is ignored, as it always was. A start/cancel frame is
 * answered with a stderr frame (and, when it carries a usable id, a failing exit
 * frame for that job) so the client sees why nothing ran.
 */
function rejectInvalidJobFrame(ws: WebSocket, frame: unknown, reason: string): void {
  if (typeof frame !== 'object' || frame === null || Array.isArray(frame)) {
    sendWs(ws, { type: 'stderr', content: 'Failed to parse message: expected a JSON object' });
    return;
  }
  const { type, id } = frame as { type?: unknown; id?: unknown };
  if (type !== 'start' && type !== 'cancel') {
    return;
  }
  if (typeof id !== 'string' || id.length === 0) {
    sendWs(ws, { type: 'stderr', content: `Invalid ${type} message: missing id` });
    return;
  }
  sendWs(ws, { type: 'stderr', content: `Invalid ${type} message: ${reason}`, id });
  sendWs(ws, { type: 'exit', code: 1, id });
}

const DEFAULT_PORT = 3334;
// The hub is hard-pinned to loopback. Any caller-supplied host is ignored.
const BIND_HOST = '127.0.0.1';

// Interval between SSE keepalive comment pings. Kept well under typical proxy
// idle timeouts (often 60s) so streams survive intermediaries.
const SSE_PING_INTERVAL_MS = 15000;

// Active jobs tracked by ID -> ChildProcess
const activeJobs = new Map<string, ChildProcess>();

// WebSocket connections
const wsConnections = new Set<WebSocket>();

// Heartbeat interval handle
let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Constant-time comparison of two tokens to avoid timing side-channels.
 * Returns false for any length mismatch or missing value.
 */
function tokensMatch(expected: string, provided: string | null | undefined): boolean {
  if (!expected || !provided) {
    return false;
  }
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Resolve the re-shell CLI invocation prefix. The hub may ONLY ever invoke the
 * re-shell CLI binary — never an arbitrary command[0]. When RE_SHELL_CLI_BIN
 * points at a JS entry (the common case, set by the launcher to the CLI's own
 * argv[1]), it is run under the current Node executable. A bare command name is
 * invoked directly. Either way, command[0] is fixed here, not browser-supplied.
 */
function resolveCliInvocation(cliBin: string): string[] {
  const looksLikeJsEntry = /\.[cm]?js$/i.test(cliBin) || cliBin.includes(path.sep);
  if (looksLikeJsEntry) {
    return [process.execPath, cliBin];
  }
  return [cliBin];
}

/**
 * Coerce a child process exit into a numeric exit code. Node delivers `code` as
 * null when the process was terminated by a signal, so we map any signalled
 * termination to 1 and a clean signal-less null to 0. The result is always a
 * number — the wire contract never carries `code: undefined`.
 */
function coerceExitCode(code: number | null, signal: NodeJS.Signals | null): number {
  return code ?? (signal ? 1 : 0);
}

/**
 * Realpath a directory if it exists, else fall back to its lexical resolution.
 * Symlinks are followed so containment cannot be bypassed via a symlinked path
 * that points outside the workspace root.
 */
function safeRealpath(dir: string): string {
  try {
    return fs.realpathSync(dir);
  } catch {
    return path.resolve(dir);
  }
}

/**
 * Contain a requested cwd to the workspace root. Returns the resolved absolute
 * path on success, or null when the request escapes the workspace.
 *
 * The workspace root itself is realpath'd, then the candidate is resolved
 * relative to it and realpath'd; the candidate must be the root or a descendant.
 */
function containCwd(requested: string | undefined, workspaceRoot: string): string | null {
  const root = safeRealpath(workspaceRoot);
  if (requested === undefined) {
    return root;
  }
  const candidate = path.isAbsolute(requested)
    ? path.resolve(requested)
    : path.resolve(root, requested);
  const realCandidate = safeRealpath(candidate);
  const rel = path.relative(root, realCandidate);
  const escapes = rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
  if (escapes) {
    return null;
  }
  return realCandidate;
}

/**
 * Build the set of exact origins the dashboard is allowed to use. Derived from
 * the configured dashboard port/host so we never fall back to a wildcard.
 */
function buildAllowedOrigins(
  dashboardHost: string,
  dashboardPort: number,
  extraOrigins: readonly string[] = []
): Set<string> {
  const origins = new Set<string>();
  for (const h of [dashboardHost, '127.0.0.1', 'localhost']) {
    origins.add(`http://${h}:${dashboardPort}`);
    origins.add(`https://${h}:${dashboardPort}`);
  }
  for (const extra of extraOrigins) {
    origins.add(extra);
  }
  return origins;
}

// An exact web origin: scheme (http, https, or the desktop shell's `tauri`
// scheme) + host + optional port. No path, no wildcard, no userinfo. `tauri://`
// is a non-special URL scheme, so `new URL(x).origin` reports the opaque
// "null" for it; the allowlist therefore validates the literal string.
const EXACT_ORIGIN_RE = /^(?:https?|tauri):\/\/[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i;

/**
 * Parse `RE_SHELL_UI_HUB_ALLOWED_ORIGINS`: a comma-separated list of EXACT extra
 * origins the hub should accept in addition to the dashboard's own http origin.
 * The desktop shell uses it for its webview origin (`tauri://localhost`, or
 * `http://tauri.localhost` on Windows), which is not an http dashboard port.
 *
 * Anything that is not an exact origin (wildcards, paths, other schemes, empty
 * entries) is dropped, so a malformed value can only ever narrow the allowlist,
 * never widen it to a pattern. Unset/empty yields no extras (browser flow is
 * unchanged).
 */
export function parseAllowedOriginsEnv(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  const accepted: string[] = [];
  for (const entry of raw.split(',')) {
    const candidate = entry.trim();
    if (candidate && EXACT_ORIGIN_RE.test(candidate)) {
      accepted.push(candidate.toLowerCase());
    }
  }
  return accepted;
}

/**
 * Validate the session token presented on an HTTP request. The token may be
 * supplied via the `x-re-shell-ui-hub-token` header OR a `?token=` query param
 * (SSE GET is reachable by <img>/navigation, so query support is required).
 * We additionally require an explicit fetch intent (a non-simple Accept header
 * or a Sec-Fetch-* header) to reject naive cross-origin <img>/navigation loads.
 */
function isAuthorizedHttp(
  req: http.IncomingMessage,
  url: URL,
  token: string
): boolean {
  const headerToken = req.headers['x-re-shell-ui-hub-token'];
  const headerValue = Array.isArray(headerToken) ? headerToken[0] : headerToken;
  const queryToken = url.searchParams.get('token');

  if (!tokensMatch(token, headerValue) && !tokensMatch(token, queryToken)) {
    return false;
  }

  // Require evidence this is a real fetch, not an <img>/navigation/<script>
  // load. Browsers send Sec-Fetch-* on modern engines; a JSON Accept header is
  // also acceptable since simple navigations send text/html.
  const accept = (req.headers['accept'] ?? '').toString();
  const secFetchMode = req.headers['sec-fetch-mode'];
  const secFetchDest = req.headers['sec-fetch-dest'];

  if (secFetchDest === 'image' || secFetchDest === 'document') {
    return false;
  }
  const looksLikeFetch =
    secFetchMode !== undefined ||
    accept.includes('application/json') ||
    accept.includes('text/event-stream');

  return looksLikeFetch;
}

/**
 * Validate the Origin/Host of a WebSocket upgrade. WebSocket upgrades are NOT
 * subject to browser CORS, so this explicit allowlist check is the real control
 * against DNS-rebinding and cross-site WS connections.
 */
function isAuthorizedWsUpgrade(
  req: http.IncomingMessage,
  allowedOrigins: Set<string>
): boolean {
  const origin = req.headers['origin'];
  if (origin !== undefined) {
    if (!allowedOrigins.has(origin)) {
      return false;
    }
  }

  // Defend against DNS-rebinding: the Host header must be a loopback name on the
  // expected hub port. A rebinding attack resolves an attacker domain to
  // 127.0.0.1, so the Host header would carry the attacker hostname.
  const hostHeader = (req.headers['host'] ?? '').toString();
  const [hostName] = hostHeader.split(':');
  if (hostName !== '127.0.0.1' && hostName !== 'localhost') {
    return false;
  }

  return true;
}

/**
 * Extract a token from a WebSocket upgrade request. Tokens are smuggled via the
 * Sec-WebSocket-Protocol header (browser WS cannot set custom headers).
 */
function extractWsHandshakeToken(req: http.IncomingMessage): string | null {
  const protoHeader = req.headers['sec-websocket-protocol'];
  if (!protoHeader) {
    return null;
  }
  const protocols = protoHeader
    .toString()
    .split(',')
    .map((p) => p.trim());
  for (const proto of protocols) {
    if (proto.startsWith(WS_TOKEN_PROTOCOL_PREFIX)) {
      return proto.slice(WS_TOKEN_PROTOCOL_PREFIX.length);
    }
  }
  return null;
}

/**
 * Fan out a connection-level message (the keepalive heartbeat) to ALL connected
 * WebSocket clients. Per-job stdout/stderr/exit are NEVER broadcast here — they
 * are delivered only to the socket that started the job, so one client cannot
 * observe another client's output.
 */
function broadcastToWs(message: WsServerMessage) {
  const payload = JSON.stringify(message);
  for (const ws of wsConnections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/**
 * Start the hub server that bridges CLI to browser via SSE and WebSocket.
 */
export async function startHubServer(
  options: StartHubServerOptions = {}
): Promise<HubServerInfo> {
  // Port resolution precedence: env override → explicit option → default.
  // `port: 0` is a VALID request for an OS-assigned ephemeral port, so it must
  // NOT be coerced away by `||` (which treats 0 as falsy). Each source is
  // checked for being a real number before falling through.
  const envPort = Number.parseInt(process.env.RE_SHELL_UI_HUB_PORT ?? '', 10);
  const port = Number.isInteger(envPort)
    ? envPort
    : Number.isInteger(options.port)
      ? (options.port as number)
      : DEFAULT_PORT;
  // Host is hard-pinned to loopback; any caller-supplied host is ignored.
  const host = BIND_HOST;

  // Session token enforced on every route. Generated by the launcher per run.
  const token = process.env.RE_SHELL_UI_HUB_TOKEN ?? '';
  if (!token) {
    return Promise.reject(
      new Error(
        'RE_SHELL_UI_HUB_TOKEN is not set. The hub refuses to start without a session token.'
      )
    );
  }

  // Dashboard origin allowlist derived from the configured dashboard port/host.
  const dashboardHost = process.env.VITE_RE_SHELL_UI_HOST || '127.0.0.1';
  const dashboardPort =
    parseInt(process.env.VITE_RE_SHELL_UI_PORT ?? '', 10) || port - 1;
  const extraOrigins = parseAllowedOriginsEnv(process.env.RE_SHELL_UI_HUB_ALLOWED_ORIGINS);
  const allowedOrigins = buildAllowedOrigins(dashboardHost, dashboardPort, extraOrigins);
  const primaryOrigin = `http://${dashboardHost}:${dashboardPort}`;

  // Get workspace context from environment. The workspace root is realpath'd
  // once and used as the containment boundary for every job's cwd.
  const workspaceRoot = safeRealpath(process.env.RE_SHELL_WORKSPACE || '.');
  const cliBin = process.env.RE_SHELL_CLI_BIN || 're-shell';
  // Fixed CLI invocation prefix (command[0..]). Browser input never reaches it.
  const cliInvocation = resolveCliInvocation(cliBin);

  /**
   * Apply CORS headers using an exact-origin allowlist (never a wildcard).
   * Echoes the request Origin only when it is in the allowlist.
   */
  function applyCors(req: http.IncomingMessage, res: http.ServerResponse): void {
    const origin = req.headers['origin'];
    const allowedOrigin =
      typeof origin === 'string' && allowedOrigins.has(origin) ? origin : primaryOrigin;
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Re-Shell-UI-Hub-Token');
  }

  // Opt-in access log (RE_SHELL_UI_HUB_ACCESS_LOG=1): one line per HTTP request
  // and WS upgrade with method, PATH ONLY (the query can carry the session
  // token, so it is never logged), response status and Origin. It makes a
  // launcher's "the dashboard connected with the token" claim auditable. Off by
  // default, so the CLI/browser flow's output is unchanged.
  const accessLog = process.env.RE_SHELL_UI_HUB_ACCESS_LOG === '1';
  const requestPath = (rawUrl: string | undefined): string => (rawUrl ?? '/').split('?')[0] || '/';

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (accessLog) {
        const origin = req.headers['origin'] ?? '-';
        const logged = `${req.method} ${requestPath(req.url)}`;
        res.once('close', () => {
          console.log(`[hub-server] access ${logged} -> ${res.statusCode} origin=${origin}`);
        });
      }
      applyCors(req, res);

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url ?? '/', `http://${BIND_HOST}:${port}`);

      // Enforce the session token on every route before any handler runs.
      if (!isAuthorizedHttp(req, url, token)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      // Health check endpoint
      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
        return;
      }

      // Status endpoint
      if (req.method === 'GET' && url.pathname === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'connected',
            hub: true,
            timestamp: Date.now(),
          })
        );
        return;
      }

      // SSE /events endpoint
      // Query params: commandId (string), params (JSON string), cwd (string).
      // Only a registered commandId + schema-valid params is ever spawned; no
      // free-form command/argv is accepted.
      if (req.method === 'GET' && url.pathname === '/events') {
        const commandId = url.searchParams.get('commandId');
        const paramsRaw = url.searchParams.get('params');
        const cwdParam = url.searchParams.get('cwd') ?? undefined;

        if (!commandId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required query param: commandId' }));
          return;
        }

        // Parse params JSON (if provided). Malformed JSON is a 400, never a spawn.
        let params: unknown = {};
        if (paramsRaw) {
          try {
            params = JSON.parse(paramsRaw);
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid params: not valid JSON' }));
            return;
          }
        }

        // Resolve commandId + params to a vetted argv via the registry. An
        // unregistered id or invalid params is rejected WITHOUT spawning.
        const resolved = resolveCommand(commandId, params);
        if (!resolved.ok) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: resolved.error }));
          return;
        }

        // Contain the cwd to the workspace root. The cwd may come from the
        // top-level query param or from the resolved params; both are checked.
        const requestedCwd = resolved.cwd ?? cwdParam;
        const cwd = containCwd(requestedCwd, workspaceRoot);
        if (cwd === null) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'cwd is outside the workspace root' }));
          return;
        }

        // Set SSE headers. The exact-origin CORS header was already applied by
        // applyCors() above and is preserved here.
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        // Spawn the re-shell CLI binary with the vetted argv. NO shell: argv
        // elements are passed literally, so injection strings cannot be
        // interpreted. command[0] is the fixed CLI invocation, never user input.
        const [binary, ...binaryArgs] = [...cliInvocation, ...resolved.args];
        const child = spawn(binary, binaryArgs, {
          cwd,
          env: { ...process.env, RE_SHELL_WORKSPACE: cwd },
        });

        // Track this child against its originating request so it can be reaped
        // on client disconnect. Output is written ONLY to this response stream;
        // there is no fan-out to other connections.
        const requestChildren = new Set<ChildProcess>();
        requestChildren.add(child);

        // Periodic SSE comment pings keep the stream alive behind proxies and
        // load balancers that would otherwise close an idle connection. A
        // comment line (": ...") is ignored by the EventSource parser. The
        // handle is cleared on stream end (child close/error) and on client
        // disconnect so the interval never outlives the response.
        const ssePing = setInterval(() => {
          res.write(': ping\n\n');
        }, SSE_PING_INTERVAL_MS);

        // Stream stdout line-by-line as SSE events
        child.stdout?.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter((line) => line.trim());
          for (const line of lines) {
            writeSseEvent(res, { type: 'stdout', content: line });
          }
        });

        child.stderr?.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter((line) => line.trim());
          for (const line of lines) {
            writeSseEvent(res, { type: 'stderr', content: line });
          }
        });

        child.on('close', (code, signal) => {
          clearInterval(ssePing);
          requestChildren.delete(child);
          const exitCode = coerceExitCode(code, signal);
          writeSseEvent(res, { type: 'exit', code: exitCode });
          res.end();
        });

        child.on('error', (err) => {
          clearInterval(ssePing);
          requestChildren.delete(child);
          writeSseEvent(res, { type: 'stderr', content: err.message });
          writeSseEvent(res, { type: 'exit', code: 1 });
          res.end();
        });

        // Handle client disconnect: reap every child started by this request so
        // an SSE disconnect never orphans a running CLI process. Also clears the
        // keepalive interval so it does not leak after the stream is gone.
        req.on('close', () => {
          clearInterval(ssePing);
          for (const c of requestChildren) {
            if (!c.killed) {
              c.kill('SIGTERM');
            }
          }
          requestChildren.clear();
        });

        return;
      }

      // 404 for unmatched routes
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    // Create WebSocket server in noServer mode so we can enforce origin/host
    // and the session token on the upgrade ourselves (WS is not CORS-gated).
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket: Socket, head) => {
      const upgradeUrl = new URL(req.url ?? '/', `http://${BIND_HOST}:${port}`);

      const rejectUpgrade = (status: string): void => {
        if (accessLog) {
          console.log(
            `[hub-server] access WS ${requestPath(req.url)} -> ${status} origin=${req.headers['origin'] ?? '-'}`
          );
        }
        socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
        socket.destroy();
      };

      if (upgradeUrl.pathname !== '/jobs') {
        rejectUpgrade('404 Not Found');
        return;
      }

      // Origin/Host validation blocks DNS-rebinding and cross-site WS.
      if (!isAuthorizedWsUpgrade(req, allowedOrigins)) {
        rejectUpgrade('403 Forbidden');
        return;
      }

      // Token may be supplied on the handshake via Sec-WebSocket-Protocol.
      const handshakeToken = extractWsHandshakeToken(req);
      const tokenOnHandshake = tokensMatch(token, handshakeToken);

      if (accessLog) {
        console.log(
          `[hub-server] access WS ${requestPath(req.url)} -> 101 origin=${req.headers['origin'] ?? '-'} token=${tokenOnHandshake ? 'valid' : 'deferred-to-first-message'}`
        );
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req, tokenOnHandshake);
      });
    });

    wss.on('connection', (ws: WebSocket, _req: http.IncomingMessage, tokenOnHandshake: boolean) => {
      // If the token was not validated on the handshake, the client MUST send it
      // in the first WS message ({ type: 'auth', token }) before any job runs.
      let authenticated = tokenOnHandshake === true;

      // Children started by THIS socket, keyed by job id. On disconnect every
      // entry is SIGTERM'd so a WS close never orphans a running CLI process.
      const socketJobs = new Map<string, ChildProcess>();

      if (authenticated) {
        wsConnections.add(ws);
      }

      ws.on('message', (data: Buffer) => {
        try {
          // Frames are untrusted until validated against the shared contract.
          const frame: unknown = JSON.parse(data.toString());

          // Pre-auth gate: the only accepted message before auth is the auth
          // handshake. Everything else closes the socket with a policy code.
          if (!authenticated) {
            const auth = wsAuthMessageSchema.safeParse(frame);
            if (auth.success && tokensMatch(token, auth.data.token)) {
              authenticated = true;
              wsConnections.add(ws);
              sendWs(ws, { type: 'heartbeat', ts: new Date().toISOString() });
              return;
            }
            ws.close(WS_POLICY_VIOLATION, 'Unauthorized');
            return;
          }

          const job = wsJobMessageSchema.safeParse(frame);
          if (!job.success) {
            rejectInvalidJobFrame(ws, frame, job.error.issues[0]?.message ?? 'invalid message');
            return;
          }
          const message = job.data;
          if (message.id.length === 0) {
            rejectInvalidJobFrame(ws, frame, 'missing id');
            return;
          }

          if (message.type === 'start') {
            const { id, commandId, params } = message;

            // Resolve commandId + params to a vetted argv via the registry. An
            // unregistered id or invalid params is rejected WITHOUT spawning.
            const resolved = resolveCommand(commandId, params ?? {});
            if (!resolved.ok) {
              sendWs(ws, { type: 'stderr', content: resolved.error, id });
              sendWs(ws, { type: 'exit', code: 1, id });
              return;
            }

            // Contain the cwd to the workspace root before spawning.
            const resolvedCwd = containCwd(resolved.cwd, workspaceRoot);
            if (resolvedCwd === null) {
              sendWs(ws, { type: 'stderr', content: 'cwd is outside the workspace root', id });
              sendWs(ws, { type: 'exit', code: 1, id });
              return;
            }

            // Spawn the re-shell CLI binary with the vetted argv. NO shell:
            // injection strings in params land as literal argv elements.
            // command[0] is the fixed CLI invocation, never browser input.
            const [binary, ...binaryArgs] = [...cliInvocation, ...resolved.args];
            const child = spawn(binary, binaryArgs, {
              cwd: resolvedCwd,
              env: { ...process.env, RE_SHELL_WORKSPACE: resolvedCwd },
            });

            // Track the job globally (for shutdown) AND against this socket (so
            // it can be reaped on disconnect). Output goes ONLY to this socket;
            // there is no fan-out to other connections.
            activeJobs.set(id, child);
            socketJobs.set(id, child);

            // Stream stdout to the originating socket only
            child.stdout?.on('data', (data: Buffer) => {
              sendWs(ws, { type: 'stdout', content: data.toString(), id });
            });

            // Stream stderr to the originating socket only
            child.stderr?.on('data', (data: Buffer) => {
              sendWs(ws, { type: 'stderr', content: data.toString(), id });
            });

            // Handle exit (originating socket only). Exit code is always numeric.
            child.on('close', (code, signal) => {
              sendWs(ws, { type: 'exit', code: coerceExitCode(code, signal), id });
              activeJobs.delete(id);
              socketJobs.delete(id);
            });

            child.on('error', (err) => {
              sendWs(ws, { type: 'stderr', content: err.message, id });
              sendWs(ws, { type: 'exit', code: 1, id });
              activeJobs.delete(id);
              socketJobs.delete(id);
            });
          } else if (message.type === 'cancel') {
            const { id } = message;

            const child = socketJobs.get(id);
            if (child) {
              child.kill('SIGTERM');
              activeJobs.delete(id);
              socketJobs.delete(id);
              sendWs(ws, { type: 'exit', code: 130, id }); // 130 = SIGTERM
            }
          }
        } catch (err) {
          sendWs(ws, { type: 'stderr', content: `Failed to parse message: ${err}` });
        }
      });

      // Reap every child started by this socket so a WS disconnect (close or
      // error) can never orphan a running CLI process. Mirrors the SSE
      // req.on('close') cleanup, eliminating the SSE-vs-WS asymmetry.
      const reapSocketJobs = (): void => {
        for (const [id, child] of socketJobs) {
          if (!child.killed) {
            child.kill('SIGTERM');
          }
          activeJobs.delete(id);
        }
        socketJobs.clear();
      };

      ws.on('close', () => {
        reapSocketJobs();
        wsConnections.delete(ws);
      });

      ws.on('error', (err: Error) => {
        console.error('[hub-server] WebSocket error:', err);
        reapSocketJobs();
        wsConnections.delete(ws);
      });
    });

    // Start heartbeat to keep connections alive
    heartbeatInterval = setInterval(() => {
      const heartbeat: WsServerMessage = { type: 'heartbeat', ts: new Date().toISOString() };
      broadcastToWs(heartbeat);
    }, 30000);

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use`));
      } else {
        reject(err);
      }
    });

    // Host is hard-pinned to loopback (BIND_HOST) regardless of any input.
    server.listen(port, host, () => {
      // When `port` is 0 the OS assigns a real ephemeral port; read it back from
      // the bound address so callers always learn the concrete listening port.
      const address = server.address();
      const boundPort = typeof address === 'object' && address ? address.port : port;
      const url = `http://${host}:${boundPort}`;
      console.log(`[hub-server] Running at ${url} (loopback-only, token-protected)`);
      console.log(`[hub-server] Allowed dashboard origin: ${primaryOrigin}`);
      if (extraOrigins.length > 0) {
        console.log(`[hub-server] Additional allowed origins: ${extraOrigins.join(', ')}`);
      }
      console.log(`[hub-server] SSE endpoint: GET ${url}/events?commandId=<id>&params=<json>&cwd=<cwd>&token=<token>`);
      console.log(`[hub-server] WebSocket endpoint: WS ${url}/jobs (token via Sec-WebSocket-Protocol or first message)`);
      resolve({ port: boundPort, url, server });
    });
  });
}

/**
 * Stops the hub server gracefully.
 */
export function stopHubServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    // Clear heartbeat interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    // Terminate all active jobs
    for (const [id, child] of activeJobs) {
      console.log(`[hub-server] Terminating job: ${id}`);
      child.kill('SIGTERM');
    }
    activeJobs.clear();

    // Close all WebSocket connections
    for (const ws of wsConnections) {
      ws.close();
    }
    wsConnections.clear();

    server.close(() => {
      console.log('[hub-server] Stopped');
      resolve();
    });
    // `close()` alone waits for every open connection to end, and a connected
    // dashboard holds long-lived SSE streams, so a graceful stop would stall
    // until the caller's hard-exit timer. Drop the remaining connections now
    // (Node >= 18.2) so the port is released promptly.
    server.closeAllConnections?.();
  });
}
