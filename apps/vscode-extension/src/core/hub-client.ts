import { z } from 'zod';
import type { CatalogEntry } from './catalog.js';

/**
 * PURE module. No VS Code, no network I/O.
 *
 * Shapes requests to the local Re-Shell UI hub. The hub NEVER accepts a raw
 * command/argv from a client; it only accepts a stable `commandId` + opaque
 * `params`, which it resolves against its own allow-list registry
 * (apps/web/src/hub/command-registry.ts). This module mirrors that contract:
 *
 *   - It maps a catalog entry to the hub's `run` allow-list (the only generic
 *     entry the hub exposes), via `subcommand`.
 *   - It builds the exact SSE request descriptor the hub expects:
 *       GET /events?commandId=<id>&params=<json>&cwd=<cwd>
 *     with the token in the `x-re-shell-ui-hub-token` header AND `?token=`.
 *
 * Building the descriptor is side-effect-free; the thin VS Code layer performs
 * the actual fetch. That keeps request shaping fully unit-testable.
 */

/**
 * The hub's `run` allow-list of subcommand paths (kept in sync with
 * RUN_ALLOWED_SUBCOMMANDS in apps/web/src/hub/command-registry.ts). A catalog
 * entry is hub-runnable only if its path is on this list.
 */
export const HUB_RUN_ALLOWED_SUBCOMMANDS = [
  'workspace summary',
  'workspace graph',
  'workspace health',
  'workspace list',
  'workspace validate',
  'templates list',
  'commands list',
  'doctor',
  'analyze',
] as const;

export type HubRunSubcommand = (typeof HUB_RUN_ALLOWED_SUBCOMMANDS)[number];

const hubRunSubcommandSchema = z.enum(HUB_RUN_ALLOWED_SUBCOMMANDS);

/** Connection details for the local hub. */
export interface HubConfig {
  /** Base URL, e.g. `http://127.0.0.1:5179`. */
  readonly baseUrl: string;
  /** Session token presented to the hub. */
  readonly token: string;
}

/** True when a catalog entry maps onto the hub `run` allow-list. */
export function isHubRunnable(entry: CatalogEntry): boolean {
  return hubRunSubcommandSchema.safeParse(entry.path).success;
}

/**
 * Map a catalog entry to the hub `run` request `{ commandId, params }`. Only
 * allow-listed subcommands resolve; everything else is rejected (the editor
 * must fall back to copy/paste rather than execute).
 */
export type HubRunRequest =
  | { ok: true; commandId: 'run'; params: { subcommand: HubRunSubcommand; cwd?: string } }
  | { ok: false; error: string };

export function toHubRunRequest(entry: CatalogEntry, cwd?: string): HubRunRequest {
  const parsed = hubRunSubcommandSchema.safeParse(entry.path);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        `"${entry.path}" is not on the hub run allow-list. ` +
        `Allowed: ${HUB_RUN_ALLOWED_SUBCOMMANDS.join(', ')}.`,
    };
  }
  const params: { subcommand: HubRunSubcommand; cwd?: string } = { subcommand: parsed.data };
  if (cwd !== undefined && cwd !== '') {
    params.cwd = cwd;
  }
  return { ok: true, commandId: 'run', params };
}

/**
 * A fully-described, side-effect-free HTTP request the thin layer can hand to
 * `fetch`. Shaping it here (not firing it) keeps the contract testable.
 */
export interface HubHttpRequest {
  readonly method: 'GET';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * Build the SSE `/events` request descriptor for a `{ commandId, params }`
 * pair. Token is sent BOTH as the `x-re-shell-ui-hub-token` header and as a
 * `?token=` query param (the hub accepts either; the header is the canonical
 * fetch path, the query param keeps parity with browser SSE).
 *
 * `Sec-Fetch-Mode: cors` is set so the hub's anti-`<img>`/navigation guard
 * accepts the request as a genuine programmatic fetch.
 */
export function buildEventsRequest(
  config: HubConfig,
  commandId: string,
  params: unknown
): HubHttpRequest {
  const base = config.baseUrl.replace(/\/+$/, '');
  const url = new URL(`${base}/events`);
  url.searchParams.set('commandId', commandId);
  url.searchParams.set('params', JSON.stringify(params ?? {}));
  url.searchParams.set('token', config.token);

  return {
    method: 'GET',
    url: url.toString(),
    headers: {
      'x-re-shell-ui-hub-token': config.token,
      Accept: 'text/event-stream',
      'Sec-Fetch-Mode': 'cors',
    },
  };
}

/** Build the `/health` probe descriptor (used to verify the hub is reachable). */
export function buildHealthRequest(config: HubConfig): HubHttpRequest {
  const base = config.baseUrl.replace(/\/+$/, '');
  const url = new URL(`${base}/health`);
  url.searchParams.set('token', config.token);
  return {
    method: 'GET',
    url: url.toString(),
    headers: {
      'x-re-shell-ui-hub-token': config.token,
      Accept: 'application/json',
      'Sec-Fetch-Mode': 'cors',
    },
  };
}
