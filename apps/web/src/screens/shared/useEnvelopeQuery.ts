import { useHubQuery } from '@umutkorkmaz/ui';
import type { ErrorCode, JsonResponse } from '@umutkorkmaz/contracts';
import { jsonResponseSchema } from '@umutkorkmaz/contracts';
import type { z } from 'zod';

/**
 * Outcome of a hub read once the canonical `{ ok, data | error }` envelope has
 * been validated and unwrapped. Distinguishes three terminal states the screens
 * must each render explicitly:
 *
 *  - transport / validation failure (`error`)
 *  - a CLI error envelope (`envelopeError`, e.g. WORKSPACE_NOT_FOUND)
 *  - success with validated `data`
 */
export interface EnvelopeQueryResult<TData> {
  isLoading: boolean;
  /** Transport, abort, or schema-validation failure. */
  error: Error | null;
  /** CLI-side error envelope (`ok:false`) with a stable error code. */
  envelopeError: { code: ErrorCode; message: string } | null;
  /** Validated success payload, or null until/unless success. */
  data: TData | null;
  warnings: string[];
  refetch: () => void;
}

/**
 * Cacheable hub read that validates the FULL response envelope
 * (`jsonResponseSchema(dataSchema)`) and unwraps it, so a CLI error branch
 * (`ok:false`) surfaces as a typed {@link EnvelopeQueryResult.envelopeError}
 * instead of a generic schema-validation failure. The data branch is validated
 * against `dataSchema` and returned as `data`.
 */
export function useEnvelopeQuery<TSchema extends z.ZodTypeAny>(
  commandId: string,
  dataSchema: TSchema,
  params?: unknown
): EnvelopeQueryResult<z.infer<TSchema>> {
  const envelopeSchema = jsonResponseSchema(dataSchema);
  const query = useHubQuery(commandId, params, { schema: envelopeSchema });
  const { isLoading, error, refetch } = query;
  // The schema's discriminated-union output is structurally the JsonResponse
  // envelope; narrow against the documented contract type for clean .ok branching.
  const data = query.data as JsonResponse<z.infer<TSchema>> | undefined;

  if (data === undefined) {
    return {
      isLoading,
      error: error ?? null,
      envelopeError: null,
      data: null,
      warnings: [],
      refetch: () => void refetch(),
    };
  }

  if (data.ok) {
    return {
      isLoading,
      error: null,
      envelopeError: null,
      data: data.data,
      warnings: data.warnings,
      refetch: () => void refetch(),
    };
  }

  return {
    isLoading,
    error: null,
    envelopeError: { code: data.error.code, message: data.error.message },
    data: null,
    warnings: data.warnings,
    refetch: () => void refetch(),
  };
}
