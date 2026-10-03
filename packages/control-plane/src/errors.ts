import { z } from 'zod';

/**
 * Closed set of error codes the control plane can return.
 *
 * Mirrors the CLI's `ErrorCode` discipline in @re-shell/contracts: a stable,
 * documented vocabulary authored as a zod enum so it validates at runtime and
 * the TS union can never drift. Every code here is ALSO a member of
 * `errorCodeSchema` in @re-shell/contracts (enforced by a test), so the
 * dashboard can parse CLI and control-plane envelopes with one parser.
 *
 * Each code maps to an HTTP status in {@link HTTP_STATUS_BY_CODE}; the HTTP
 * edge (http/server.ts) uses that table to turn a result envelope into a
 * response.
 */
export const controlPlaneErrorCodeSchema = z.enum([
  // Authentication: caller could not be identified.
  'UNAUTHENTICATED',
  // Authorization: caller is known but not permitted for this tenant/action.
  'FORBIDDEN',
  // The requested tenant does not exist.
  'TENANT_NOT_FOUND',
  // The requested workspace does not exist within the resolved tenant.
  'WORKSPACE_NOT_FOUND',
  // The request body/params failed schema validation.
  'INVALID_REQUEST',
  // The requested command id is not on the tenant's allow-list.
  'COMMAND_NOT_ALLOWED',
  // --- Hosted-server additions (P9-J) ---
  // No such route.
  'NOT_FOUND',
  // The route exists but not for this HTTP method.
  'METHOD_NOT_ALLOWED',
  // A create collided with an existing record.
  'ALREADY_EXISTS',
  // The change would violate an invariant (e.g. removing a tenant's last admin).
  'CONFLICT',
  // The job does not exist within the resolved tenant (same answer for "belongs
  // to another tenant", like WORKSPACE_NOT_FOUND).
  'JOB_NOT_FOUND',
  // Per-principal rate limit or per-tenant queue limit exceeded.
  'RATE_LIMITED',
  // The request body exceeded the configured size limit.
  'PAYLOAD_TOO_LARGE',
  // A request body was sent with a non-JSON content type.
  'UNSUPPORTED_MEDIA_TYPE',
  // Misconfiguration detected by a CLI subcommand (bad env, missing key, ...).
  'CONFIG_ERROR',
  // Unexpected server fault (details are logged, never returned).
  'INTERNAL_ERROR',
  // A dependency (the database) is unavailable.
  'SERVICE_UNAVAILABLE',
  // --- Real-time collaboration additions (P9-N) ---
  // The session does not exist in the resolved tenant (same answer for "belongs
  // to another tenant").
  'SESSION_NOT_FOUND',
  // The session has ended; it is read-only history.
  'SESSION_ENDED',
  // A command is already queued or running in this session.
  'SESSION_BUSY',
  // Only the session's current driver may do this.
  'NOT_SESSION_DRIVER',
  // The named user is not a participant of the session.
  'PARTICIPANT_NOT_FOUND',
  // The shared document does not exist in the session.
  'DOCUMENT_NOT_FOUND',
]);

export type ControlPlaneErrorCode = z.infer<typeof controlPlaneErrorCodeSchema>;

/**
 * HTTP status for each error code. The HTTP edge maps every failure envelope
 * through this table; there is no other source of status codes.
 */
export const HTTP_STATUS_BY_CODE: Readonly<Record<ControlPlaneErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  TENANT_NOT_FOUND: 404,
  WORKSPACE_NOT_FOUND: 404,
  INVALID_REQUEST: 400,
  COMMAND_NOT_ALLOWED: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  ALREADY_EXISTS: 409,
  CONFLICT: 409,
  JOB_NOT_FOUND: 404,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  CONFIG_ERROR: 500,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  SESSION_NOT_FOUND: 404,
  SESSION_ENDED: 409,
  SESSION_BUSY: 409,
  NOT_SESSION_DRIVER: 403,
  PARTICIPANT_NOT_FOUND: 404,
  DOCUMENT_NOT_FOUND: 404,
};

/**
 * Error payload nested inside a control-plane error envelope.
 */
export interface ControlPlaneErrorBody {
  code: ControlPlaneErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Canonical control-plane result envelope. Intentionally shaped like the CLI's
 * JSON envelope ({ ok, data, warnings } / { ok, error, warnings }) so the
 * dashboard can consume both surfaces with one parser.
 */
export type ControlPlaneResult<T> =
  | { ok: true; data: T; warnings: string[] }
  | { ok: false; error: ControlPlaneErrorBody; warnings: string[] };

/** Build a success envelope. */
export function ok<T>(data: T, warnings: string[] = []): ControlPlaneResult<T> {
  return { ok: true, data, warnings };
}

/** Build an error envelope. Never throws; the caller decides how to surface it. */
export function fail<T = never>(
  code: ControlPlaneErrorCode,
  message: string,
  details?: Record<string, unknown>,
  warnings: string[] = []
): ControlPlaneResult<T> {
  const error: ControlPlaneErrorBody = details ? { code, message, details } : { code, message };
  return { ok: false, error, warnings };
}
