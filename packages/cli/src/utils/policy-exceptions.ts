import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';

/**
 * Policy exceptions module (Chunk 2 of the policy-pack expansion).
 *
 * An exceptions file is a YAML (or JSON) file containing a list of
 * `PolicyException` entries. Each entry waives a specific rule for a
 * specific service (or all services via "*") with an optional reason
 * and expiry date.
 *
 * `loadExceptions` reads and validates the file; `applyExceptions` filters
 * failed rule results, separating waived items from genuinely failing ones
 * and reporting any expired exceptions.
 */

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/**
 * A single policy exception entry.
 *
 * @property service - Service name or `"*"` for wildcard (all services)
 * @property rule    - Exact rule ID to waive
 * @property reason  - Optional human-readable justification
 * @property expires - Optional ISO date (`YYYY-MM-DD`); after this date the
 *                     exception is treated as expired and the failure is
 *                     reported normally.
 */
export interface PolicyException {
  service: string;
  rule: string;
  reason?: string;
  expires?: string;
}

/**
 * Result of applying exceptions to a set of failed items.
 *
 * @typeparam T - The failed-item shape (must have at least `ruleId` and
 *                optionally `service`).
 */
export interface ApplyExceptionsResult<T> {
  /** Items that are still genuinely failing (no valid exception). */
  stillFailed: T[];
  /** Items waived by a non-expired exception, enriched with waive metadata. */
  waived: (T & { waiveReason?: string; waiveExpires?: string })[];
  /** Exceptions that matched but have passed their expiry date. */
  expired: { service: string; rule: string; expires: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns today's date as a `YYYY-MM-DD` string. */
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Normalize an `expires` value to `YYYY-MM-DD`.
 *
 * The YAML parser may produce a `Date` object for unquoted dates; we convert
 * those via `.toISOString()`. Strings are returned as-is (assumed already
 * in the correct format).
 */
function normalizeExpires(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load policy exceptions from a YAML (or JSON) file.
 *
 * @param filePath - Path to the exceptions file.
 * @returns An array of `PolicyException` entries.
 * @throws   Error when the YAML is invalid or entries fail validation.
 *
 * If the file does not exist, returns `[]` (the normal case — no exceptions).
 */
export async function loadExceptions(filePath: string): Promise<PolicyException[]> {
  // File not found is the normal case — no exceptions configured.
  if (!(await fs.pathExists(filePath))) {
    return [];
  }

  const raw = await fs.readFile(filePath, 'utf8');

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse exceptions file ${filePath}: ${(err as Error).message}`
    );
  }

  // An empty file yields `undefined` — treat as no exceptions.
  if (parsed === undefined || parsed === null) {
    return [];
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `Exceptions file ${filePath} must contain a YAML list at the top level`
    );
  }

  const exceptions: PolicyException[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i];

    if (typeof entry !== 'object' || entry === null) {
      throw new Error(
        `Exceptions file ${filePath}: entry ${i} is not a mapping`
      );
    }

    const { service, rule, reason, expires } = entry as Record<string, unknown>;

    if (typeof service !== 'string' || service.length === 0) {
      throw new Error(
        `Exceptions file ${filePath}: entry ${i} has missing or invalid "service"`
      );
    }

    if (typeof rule !== 'string' || rule.length === 0) {
      throw new Error(
        `Exceptions file ${filePath}: entry ${i} has missing or invalid "rule"`
      );
    }

    const normalizedExpires = normalizeExpires(expires);

    const exception: PolicyException = {
      service,
      rule,
    };

    if (reason !== undefined) {
      exception.reason = String(reason);
    }
    if (normalizedExpires !== undefined) {
      exception.expires = normalizedExpires;
    }

    exceptions.push(exception);
  }

  return exceptions;
}

// ---------------------------------------------------------------------------
// Apply Exceptions
// ---------------------------------------------------------------------------

/**
 * Apply exceptions to a set of failed items, partitioning them into
 * still-failing, waived, and expired.
 *
 * Each failed item is expected to have at least:
 *  - `ruleId: string`
 *  - `service?: string`
 *
 * Matching logic for an item against an exception:
 *  - `exception.rule === item.ruleId` AND
 *  - `exception.service === '*' OR exception.service === item.service`
 *
 * If a match is found but the exception's `expires` date is before today,
 * the item stays in `stillFailed` and the exception is reported in `expired`.
 * Otherwise the item moves to `waived` with reason/expires attached.
 *
 * Items with no matching exception stay in `stillFailed`.
 *
 * @typeparam T - The failed-item shape.
 */
export function applyExceptions<T extends { service?: string; ruleId: string }>(
  failed: T[],
  exceptions: PolicyException[]
): ApplyExceptionsResult<T> {
  const today = todayStr();

  const stillFailed: T[] = [];
  const waived: (T & { waiveReason?: string; waiveExpires?: string })[] = [];
  const expired: { service: string; rule: string; expires: string }[] = [];

  for (const item of failed) {
    // Find the first matching exception (exact or wildcard).
    const match = exceptions.find(
      ex =>
        ex.rule === item.ruleId &&
        (ex.service === '*' || ex.service === item.service)
    );

    if (!match) {
      stillFailed.push(item);
      continue;
    }

    // Check expiry.
    if (match.expires && match.expires < today) {
      stillFailed.push(item);
      expired.push({
        service: match.service,
        rule: match.rule,
        expires: match.expires,
      });
      continue;
    }

    // Non-expired match — waive the item.
    const waivedItem: T & { waiveReason?: string; waiveExpires?: string } = {
      ...item,
    };
    if (match.reason !== undefined) {
      waivedItem.waiveReason = match.reason;
    }
    if (match.expires !== undefined) {
      waivedItem.waiveExpires = match.expires;
    }
    waived.push(waivedItem);
  }

  return { stillFailed, waived, expired };
}
