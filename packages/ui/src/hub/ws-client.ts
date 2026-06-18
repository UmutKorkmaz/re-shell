import {
  wsServerMessageSchema,
  type WsServerMessage,
  type WsClientMessage,
} from '@re-shell/contracts';
import { JsonReassembler } from './json-reassembler.js';
import { resolveHubToken } from '../hooks/config.js';

// Sec-WebSocket-Protocol prefix used to smuggle the session token on the
// browser WebSocket handshake (the browser WS API cannot set custom headers).
// Must match WS_TOKEN_PROTOCOL_PREFIX in apps/web/src/hub-server.ts.
const WS_TOKEN_PROTOCOL_PREFIX = 're-shell-token.';

export interface WsClientOptions {
  url: string;
  /**
   * Raw, schema-validated server message callback. Fires once per frame after it
   * parses against {@link wsServerMessageSchema}. Frames that fail validation are
   * surfaced via {@link onError}, never silently dropped.
   */
  onMessage: (msg: WsServerMessage) => void;
  /**
   * Reassembled-JSON callback. The hub may split a single `--json` payload across
   * many `stdout` frames; this fires only once a buffered `content` stream (keyed
   * by job id) parses into a complete JSON document, or is flushed on `exit`.
   */
  onJson?: (id: string | undefined, parsed: unknown) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  reconnect?: boolean;
  /**
   * Per-launch session token enforced by the hub on every route. When omitted,
   * it is resolved by {@link resolveHubToken} from the runtime global
   * (`window.__RE_SHELL_HUB__`) or the VITE_RE_SHELL_UI_HUB_TOKEN build env.
   */
  token?: string;
}

export class WsClient {
  private ws: WebSocket | null = null;
  private opts: WsClientOptions;
  private reconnectAttempts = 0;
  private maxReconnects = 3;
  private token: string | undefined;
  private reassembler = new JsonReassembler();

  constructor(opts: WsClientOptions) {
    this.opts = opts;
    this.token = resolveHubToken(opts.token);
  }

  connect(): void {
    // The hub authorizes the WS upgrade by reading the session token from the
    // Sec-WebSocket-Protocol header. The browser WebSocket API exposes this via
    // the optional `protocols` argument, which is the only way to attach custom
    // handshake data from a browser.
    this.ws = this.token
      ? new WebSocket(this.opts.url, `${WS_TOKEN_PROTOCOL_PREFIX}${this.token}`)
      : new WebSocket(this.opts.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.opts.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = () => {
      this.opts.onError?.(new Error('WebSocket transport error'));
    };

    this.ws.onclose = (event: CloseEvent | undefined) => {
      const code = event?.code ?? 0;
      const reason = event?.reason ?? '';
      this.opts.onClose?.(code, reason);
      // 1008 = policy violation (e.g. Unauthorized). Reconnecting would just
      // fail identically, so skip the retry loop for permanent rejections.
      if (code === 1008) return;
      if (this.opts.reconnect && this.reconnectAttempts < this.maxReconnects) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
      }
    };
  }

  /**
   * Validate one inbound frame against the contract schema, surface the raw
   * message, accumulate stdout for JSON reassembly, and flush on exit. Parse and
   * validation failures are reported via onError rather than swallowed.
   */
  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') {
      this.opts.onError?.(new Error('WebSocket frame is not a string payload'));
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      this.opts.onError?.(new Error(`WebSocket frame is not valid JSON: ${raw}`));
      return;
    }

    const result = wsServerMessageSchema.safeParse(json);
    if (!result.success) {
      this.opts.onError?.(
        new Error(`WebSocket frame failed schema validation: ${result.error.message}`)
      );
      return;
    }

    const msg = result.data;
    this.opts.onMessage(msg);

    if (msg.type === 'stdout' && msg.content !== undefined) {
      const parsed = this.reassembler.append(msg.id, msg.content);
      if (parsed !== null) {
        this.opts.onJson?.(msg.id, parsed);
      }
      return;
    }

    if (msg.type === 'exit') {
      const parsed = this.reassembler.flush(msg.id);
      if (parsed !== null) {
        this.opts.onJson?.(msg.id, parsed);
      }
    }
  }

  /**
   * Send a client->hub message. Typed against the contract {@link WsClientMessage}
   * so callers can only ever emit the allow-listed `{ id, commandId, params }`
   * (start) or `{ id }` (cancel) shape — never a raw command/argv.
   */
  send(message: WsClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  close(): void {
    this.opts.reconnect = false;
    this.ws?.close();
  }
}
