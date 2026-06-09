import { z } from 'zod';

/**
 * Closed set of error codes the control plane can return.
 *
 * Mirrors the CLI's `ErrorCode` discipline in @re-shell/contracts: a stable,
 * documented vocabulary authored as a zod enum so it validates at runtime and
 * the TS union can never drift. The control plane is a hosted, multi-tenant
 * extension of the local hub, so its failure modes are auth/tenant-shaped rather
 * than CLI-shaped.
 *
 * ENV-LIMITED: these are returned by PURE in-process functions. There is no live
 * HTTP server here; a real deployment would map each code to an HTTP status (see
 * docs/control-plane.md).
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
]);

export type ControlPlaneErrorCode = z.infer<typeof controlPlaneErrorCodeSchema>;

/**
 * Suggested HTTP status mapping for a real deployment. NOT used by the pure
 * logic here (there is no server) — documented for the deployment outline.
 */
export const HTTP_STATUS_BY_CODE: Readonly<Record<ControlPlaneErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  TENANT_NOT_FOUND: 404,
  WORKSPACE_NOT_FOUND: 404,
  INVALID_REQUEST: 400,
  COMMAND_NOT_ALLOWED: 403,
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
