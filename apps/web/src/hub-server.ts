import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { WebSocketServer, WebSocket } from 'ws';
import type { Socket } from 'node:net';
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

interface JobMessage {
  type: 'start' | 'cancel' | 'auth';
  id?: string;
  // Browsers supply only a stable commandId + params; never a raw command/argv.
  commandId?: string;
  params?: unknown;
  token?: string;
}

interface JobResponse {
  type: 'stdout' | 'stderr' | 'exit' | 'heartbeat';
  content?: string;
  code?: number;
  id?: string;
  ts?: string;
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
function buildAllowedOrigins(dashboardHost: string, dashboardPort: number): Set<string> {
  const origins = new Set<string>();
  for (const h of [dashboardHost, '127.0.0.1', 'localhost']) {
    origins.add(`http://${h}:${dashboardPort}`);
    origins.add(`https://${h}:${dashboardPort}`);
  }
  return origins;
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
function broadcastToWs(message: JobResponse) {
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
  const allowedOrigins = buildAllowedOrigins(dashboardHost, dashboardPort);
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

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
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
            const event: JobResponse = { type: 'stdout', content: line };
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        });

        child.stderr?.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter((line) => line.trim());
          for (const line of lines) {
            const event: JobResponse = { type: 'stderr', content: line };
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        });

        child.on('close', (code, signal) => {
          clearInterval(ssePing);
          requestChildren.delete(child);
          const exitCode = coerceExitCode(code, signal);
          const event: JobResponse = { type: 'exit', code: exitCode };
          res.write(`data: ${JSON.stringify(event)}\n\n`);
          res.end();
        });

        child.on('error', (err) => {
          clearInterval(ssePing);
          requestChildren.delete(child);
          const stderr: JobResponse = { type: 'stderr', content: err.message };
          res.write(`data: ${JSON.stringify(stderr)}\n\n`);
          const exit: JobResponse = { type: 'exit', code: 1 };
          res.write(`data: ${JSON.stringify(exit)}\n\n`);
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
          const message: JobMessage = JSON.parse(data.toString());

          // Pre-auth gate: the only accepted message before auth is the auth
          // handshake. Everything else closes the socket with a policy code.
          if (!authenticated) {
            if (message.type === 'auth' && tokensMatch(token, message.token)) {
              authenticated = true;
              wsConnections.add(ws);
              ws.send(JSON.stringify({ type: 'heartbeat', ts: new Date().toISOString() }));
              return;
            }
            ws.close(WS_POLICY_VIOLATION, 'Unauthorized');
            return;
          }

          if (message.type === 'start') {
            const { id, commandId, params } = message;
            if (!id) {
              ws.send(JSON.stringify({ type: 'stderr', content: 'Invalid start message: missing id' }));
              return;
            }

            // Resolve commandId + params to a vetted argv via the registry. An
            // unregistered id or invalid params is rejected WITHOUT spawning.
            const resolved = resolveCommand(commandId, params ?? {});
            if (!resolved.ok) {
              ws.send(JSON.stringify({ type: 'stderr', content: resolved.error, id }));
              ws.send(JSON.stringify({ type: 'exit', code: 1, id }));
              return;
            }

            // Contain the cwd to the workspace root before spawning.
            const resolvedCwd = containCwd(resolved.cwd, workspaceRoot);
            if (resolvedCwd === null) {
              ws.send(JSON.stringify({ type: 'stderr', content: 'cwd is outside the workspace root', id }));
              ws.send(JSON.stringify({ type: 'exit', code: 1, id }));
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
              const content = data.toString();
              const response: JobResponse = { type: 'stdout', content, id };
              ws.send(JSON.stringify(response));
            });

            // Stream stderr to the originating socket only
            child.stderr?.on('data', (data: Buffer) => {
              const content = data.toString();
              const response: JobResponse = { type: 'stderr', content, id };
              ws.send(JSON.stringify(response));
            });

            // Handle exit (originating socket only). Exit code is always numeric.
            child.on('close', (code, signal) => {
              const response: JobResponse = { type: 'exit', code: coerceExitCode(code, signal), id };
              ws.send(JSON.stringify(response));
              activeJobs.delete(id);
              socketJobs.delete(id);
            });

            child.on('error', (err) => {
              const response: JobResponse = { type: 'stderr', content: err.message, id };
              ws.send(JSON.stringify(response));
              const exitResponse: JobResponse = { type: 'exit', code: 1, id };
              ws.send(JSON.stringify(exitResponse));
              activeJobs.delete(id);
              socketJobs.delete(id);
            });
          } else if (message.type === 'cancel') {
            const { id } = message;
            if (!id) {
              ws.send(JSON.stringify({ type: 'stderr', content: 'Invalid cancel message: missing id', id }));
              return;
            }

            const child = socketJobs.get(id);
            if (child) {
              child.kill('SIGTERM');
              activeJobs.delete(id);
              socketJobs.delete(id);
              ws.send(JSON.stringify({ type: 'exit', code: 130, id })); // 130 = SIGTERM
            }
          }
        } catch (err) {
          ws.send(JSON.stringify({ type: 'stderr', content: `Failed to parse message: ${err}` }));
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
      const heartbeat: JobResponse = { type: 'heartbeat', ts: new Date().toISOString() };
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
  });
}
